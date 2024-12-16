import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Crowdfund } from "../target/types/crowdfund";
import { PublicKey } from "@solana/web3.js";
import { expect, assert } from "chai";

describe("crowdfund", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Crowdfund as Program<Crowdfund>;

  const goal = new anchor.BN(2_000_000);
  const now = Math.floor(Date.now() / 1000);
  const deadline = new anchor.BN(now + 24 * 60 * 60);
  const pastDeadline = new anchor.BN(now - 60);

  const getCampaignId = () => {
    return Array(32)
      .fill(0)
      .map(() => Math.floor(Math.random() * 256));
  };

  describe("initialize", () => {
    it("successfully initializes a campaign", async () => {
      const campaignId = getCampaignId();
      const [campaignPda, campaignBump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("campaign"),
          provider.wallet.publicKey.toBuffer(),
          Buffer.from(campaignId),
        ],
        program.programId
      );

      await program.methods
        .initialize(goal, deadline, campaignId)
        .accounts({
          campaign: campaignPda,
          authority: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const campaign = await program.account.campaignAccount.fetch(campaignPda);

      expect(campaign.authority.toString()).to.equal(
        provider.wallet.publicKey.toString()
      );
      expect(campaign.goal.toString()).to.equal(goal.toString());
      expect(campaign.deadline.toString()).to.equal(deadline.toString());
      expect(campaign.totalRaised.toString()).to.equal("0");
      expect([...campaign.campaignId]).to.deep.equal([...campaignId]);
      expect(campaign.bump).to.equal(campaignBump);
    });
  });

  describe("donate", () => {
    let campaignPda: PublicKey;
    let campaignId: number[];

    beforeEach(async () => {
      campaignId = getCampaignId();
      [campaignPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("campaign"),
          provider.wallet.publicKey.toBuffer(),
          Buffer.from(campaignId),
        ],
        program.programId
      );

      await program.methods
        .initialize(goal, deadline, campaignId)
        .accounts({
          campaign: campaignPda,
          authority: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    });

    it("successfully donates to campaign", async () => {
      const donationAmount = new anchor.BN(1_000_000);
      const donor = anchor.web3.Keypair.generate();

      const latestBlockhash = await provider.connection.getLatestBlockhash();
      const signature = await provider.connection.requestAirdrop(
        donor.publicKey,
        2_000_000
      );
      await provider.connection.confirmTransaction({
        signature,
        ...latestBlockhash,
      });

      const initialBalance = await provider.connection.getBalance(campaignPda);

      const accounts = {
        campaign: campaignPda,
        donor: donor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      };

      await program.methods
        .donate(donationAmount)
        .accounts(accounts)
        .signers([donor])
        .rpc();

      const campaign = await program.account.campaignAccount.fetch(campaignPda);
      expect(campaign.totalRaised.toString()).to.equal(
        donationAmount.toString()
      );

      const finalBalance = await provider.connection.getBalance(campaignPda);
      expect(finalBalance - initialBalance).to.equal(donationAmount.toNumber());
    });

    it("fails to donate after deadline", async () => {
      // Create new campaign with past deadline
      const expiredCampaignId = getCampaignId();
      const [expiredCampaignPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("campaign"),
          provider.wallet.publicKey.toBuffer(),
          Buffer.from(expiredCampaignId),
        ],
        program.programId
      );

      // Initialize campaign with past deadline
      await program.methods
        .initialize(goal, pastDeadline, expiredCampaignId)
        .accounts({
          campaign: expiredCampaignPda,
          authority: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const donor = anchor.web3.Keypair.generate();

      const latestBlockhash = await provider.connection.getLatestBlockhash();
      const signature = await provider.connection.requestAirdrop(
        donor.publicKey,
        2_000_000
      );
      await provider.connection.confirmTransaction({
        signature,
        ...latestBlockhash,
      });

      const accounts = {
        campaign: expiredCampaignPda,
        donor: donor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      };

      try {
        await program.methods
          .donate(new anchor.BN(1_000_000))
          .accounts(accounts)
          .signers([donor])
          .rpc();
        assert.fail("Expected an error due to expired campaign");
      } catch (err) {
        if (err instanceof anchor.AnchorError) {
          const anchorError = err as anchor.AnchorError;
          expect(anchorError.error.errorCode.code).to.equal("CampaignExpired");
        } else {
          throw err;
        }
      }
    });

    describe("withdraw", () => {
      let campaignPda: PublicKey;
      let campaignId: number[];

      beforeEach(async () => {
        campaignId = getCampaignId();
        [campaignPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("campaign"),
            provider.wallet.publicKey.toBuffer(),
            Buffer.from(campaignId),
          ],
          program.programId
        );

        // Initialize campaign with past deadline
        await program.methods
          .initialize(goal, pastDeadline, campaignId)
          .accounts({
            campaign: campaignPda,
            authority: provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        // Fund the campaign directly for testing
        const tx = new anchor.web3.Transaction().add(
          anchor.web3.SystemProgram.transfer({
            fromPubkey: provider.wallet.publicKey,
            toPubkey: campaignPda,
            lamports: goal.toNumber(),
          })
        );
        await provider.sendAndConfirm(tx);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      });

      // it("successfully withdraws when goal met and deadline passed", async () => {
      //   // Verify conditions before withdrawal
      //   const campaignAccount = await program.account.campaignAccount.fetch(
      //     campaignPda
      //   );
      //   const campaignBalance = await provider.connection.getBalance(
      //     campaignPda
      //   );

      //   console.log(
      //     "Campaign total raised:",
      //     campaignAccount.totalRaised.toString()
      //   );
      //   console.log("Campaign goal:", goal.toString());
      //   console.log("Campaign balance:", campaignBalance);
      //   console.log("Current time:", Math.floor(Date.now() / 1000));
      //   console.log("Deadline:", campaignAccount.deadline.toString());

      //   const initialBalance = await provider.connection.getBalance(
      //     provider.wallet.publicKey
      //   );

      //   const accounts = {
      //     campaign: campaignPda,
      //     creator: provider.wallet.publicKey,
      //     systemProgram: anchor.web3.SystemProgram.programId,
      //   };

      //   await program.methods.withdraw().accounts(accounts).rpc();

      //   const finalBalance = await provider.connection.getBalance(
      //     provider.wallet.publicKey
      //   );
      //   expect(finalBalance).to.be.greaterThan(initialBalance);

      //   const finalCampaignBalance = await provider.connection.getBalance(
      //     campaignPda
      //   );
      //   expect(finalCampaignBalance).to.equal(0);
      // });

      it("fails when non-authority tries to withdraw", async () => {
        const maliciousUser = anchor.web3.Keypair.generate();

        const latestBlockhash = await provider.connection.getLatestBlockhash();
        const signature = await provider.connection.requestAirdrop(
          maliciousUser.publicKey,
          1_000_000
        );
        await provider.connection.confirmTransaction({
          signature,
          ...latestBlockhash,
        });

        const accounts = {
          campaign: campaignPda,
          creator: maliciousUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        };

        try {
          await program.methods
            .withdraw()
            .accounts(accounts)
            .signers([maliciousUser])
            .rpc();
          assert.fail("Expected an error due to unauthorized withdrawal");
        } catch (err) {
          expect(err).to.be.instanceOf(anchor.AnchorError);
        }
      });
    });
  });
});
