# Solana Crowdfunding dApp

## Project Description

This Solana-based decentralized application (dApp) enables crowdfunding campaigns using Anchor and Program Derived Addresses (PDAs). The core functionality includes:

- Creating fundraising campaigns with specific goals and deadlines
- Allowing donors to contribute solana
- Enabling campaign creators to withdraw funds if the goal is met

## Key Features

- Uses Anchor framework for Solana program development
- Implements Program Derived Address (PDA) for campaign accounts
- Includes deadline and goal-based withdrawal mechanism

## Prerequisites

- Rust
- Solana CLI
- Anchor
- Node.js
- TypeScript

## Local Setup and Testing

### Build the Anchor Program

```bash
anchor build
```

### Run Tests

```bash
anchor test
```

### Program Instructions

1. `initialize_campaign`: Create a new fundraising campaign
   - Requires: goal amount, campaign deadline
2. `donate`: Contribute solana to a campaign
3. `withdraw`: Withdraw funds after campaign deadline and goal achievement

## Error Handling

- Prevents donations after campaign deadline
- Ensures withdrawal only when goal is met and deadline passed

## Security Considerations

- Uses PDA for secure account derivation
- Implements time-based and goal-based access controls

## Deployment

The program has been deployed to Solana Devnet with the following program ID:

```bash
Program ID: C2SgoZorBofP4KUDkVeo12gEfKdg7DWCLTsuqNaJoxe4
```
