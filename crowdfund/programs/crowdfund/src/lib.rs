use anchor_lang::prelude::*;

declare_id!("8AwEsUh1mXnd4KG2n8AmtqnbuDawmeSpgNAiLPyrtZy7");

#[program]
pub mod crowdfund {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        goal: u64,
        deadline: i64,
        campaign_id: [u8; 32],
    ) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        campaign.authority = ctx.accounts.authority.key();
        campaign.goal = goal;
        campaign.deadline = deadline;
        campaign.total_raised = 0;
        campaign.bump = ctx.bumps.campaign;
        campaign.campaign_id = campaign_id;
        Ok(())
    }

    pub fn donate(ctx: Context<DonationContext>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;

        require!(
            Clock::get()?.unix_timestamp <= campaign.deadline,
            CrowdfundingError::CampaignExpired
        );

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.donor.key(),
            &campaign.to_account_info().key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.donor.to_account_info(),
                campaign.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        campaign.total_raised += amount;
        Ok(())
    }

    pub fn withdraw(ctx: Context<WithdrawContext>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;

        require!(
            campaign.total_raised >= campaign.goal
                && Clock::get()?.unix_timestamp > campaign.deadline,
            CrowdfundingError::WithdrawNotAllowed
        );

        **campaign.to_account_info().try_borrow_mut_lamports()? = 0;
        **ctx
            .accounts
            .creator
            .to_account_info()
            .try_borrow_mut_lamports()? += campaign.to_account_info().lamports();

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(goal: u64, deadline: i64, campaign_id: [u8; 32])]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [
            b"campaign",
            authority.key().as_ref(),
            campaign_id.as_ref()
        ],
        bump,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8 + 1 + 32,
        constraint = campaign.key() != authority.key()
    )]
    pub campaign: Account<'info, CampaignAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DonationContext<'info> {
    #[account(
        mut,
        seeds = [
            b"campaign",
            campaign.authority.as_ref(),
            campaign.campaign_id.as_ref()
        ],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, CampaignAccount>,

    #[account(mut)]
    pub donor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawContext<'info> {
    #[account(
        mut,
        seeds = [
            b"campaign",
            campaign.authority.as_ref(),
            campaign.campaign_id.as_ref()
        ],
        bump = campaign.bump,
        constraint = creator.key() == campaign.authority
    )]
    pub campaign: Account<'info, CampaignAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct CampaignAccount {
    pub authority: Pubkey,
    pub goal: u64,
    pub deadline: i64,
    pub total_raised: u64,
    pub bump: u8,
    pub campaign_id: [u8; 32],
}

#[error_code]
pub enum CrowdfundingError {
    #[msg("Campaign has expired")]
    CampaignExpired,
    #[msg("Withdrawal not allowed")]
    WithdrawNotAllowed,
}
