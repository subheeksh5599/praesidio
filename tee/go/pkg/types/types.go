// Package types contains PRAESIDIO's extension request/response types.
package types

import (
	"github.com/ethereum/go-ethereum/common"
)

// CheckVaultRequest is the JSON payload sent via the Solidity contract.
// The agent's defense policy is read from the GuardianRegistry on-chain;
// the guard only needs the vault + the RPC endpoints (env).
type CheckVaultRequest struct {
	AgentVault string `json:"agentVault"` // 0x-prefixed agent vault address
	GuardId    uint64 `json:"guardId"`    // registry guard id
}

// VaultHealth is the live on-chain state the guard reads.
type VaultHealth struct {
	Vault                 string `json:"vault"`
	VaultCollateralWei    string `json:"vaultCollateralWei"`
	LiqFactorVaultBIPS    string `json:"liqFactorVaultBIPS"`
	LiqFactorPoolBIPS     string `json:"liqFactorPoolBIPS"`
	MaxLiquidationAmount  string `json:"maxLiquidationAmountUBA"`
	XrpUsd                string `json:"xrpUsd"`
	CollateralRatioBIPS   uint64 `json:"collateralRatioBIPS"`
	Liquidatable          bool   `json:"liquidatable"`
	BelowPolicyThreshold  bool   `json:"belowPolicyThreshold"`
}

// CheckVaultResponse is the JSON payload returned in ActionResult.Data.
type CheckVaultResponse struct {
	Healthy  bool         `json:"healthy"`
	Health   VaultHealth  `json:"health"`
	Decision string       `json:"decision"` // TOP_UP_REQUIRED | WATCH | CLEAR
	Signed   *SignedAction `json:"signed,omitempty"`
}

// SignedAction is the attestable record the guard produces: the digest the
// GuardianRegistry verifies, signed with the enclave key.
type SignedAction struct {
	GuardId    uint64 `json:"guardId"`
	ActionType uint8  `json:"actionType"` // matches GuardianRegistry.ACTION_*
	Amount     string `json:"amount"`
	Nonce      uint64 `json:"nonce"`
	ChainId    uint64 `json:"chainId"`
	Digest     string `json:"digest"`     // 0x hex of the registry digest
	Signature  string `json:"signature"`  // 65-byte 0x hex (r||s||v)
	Signer     string `json:"signer"`     // enclave key address
}

// State holds the extension's observable state, returned by GET /state.
type State struct {
	LastCheckVault     string `json:"lastCheckVault"`
	LastDecision       string `json:"lastDecision"`
	ChecksPerformed    uint64 `json:"checksPerformed"`
	ActionsSigned      uint64 `json:"actionsSigned"`
}

// --- DO NOT MODIFY below this line. ---

// StateResponse is the envelope returned by GET /state.
type StateResponse struct {
	StateVersion common.Hash `json:"stateVersion"`
	State        State       `json:"state"`
}
