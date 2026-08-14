package extension

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"

	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// AssetManager reads used by the guard. Selectors must match the Coston2
// FAssets diamond facets.
var assetManagerABI = abi.ABI{
	Methods: map[string]abi.Method{
		"getAgentLiquidationFactorsAndMaxAmount": {
			Name:    "getAgentLiquidationFactorsAndMaxAmount",
			RawName: "getAgentLiquidationFactorsAndMaxAmount",
			Inputs:  abi.Arguments{{Name: "_agentVault", Type: addressTy}},
			Outputs: abi.Arguments{
				{Name: "liquidationPaymentFactorVaultBIPS", Type: uint256Ty},
				{Name: "liquidationPaymentFactorPoolBIPS", Type: uint256Ty},
				{Name: "maxLiquidationAmountUBA", Type: uint256Ty},
			},
		},
		"getAgentFullVaultCollateral": {
			Name:    "getAgentFullVaultCollateral",
			RawName: "getAgentFullVaultCollateral",
			Inputs:  abi.Arguments{{Name: "_agentVault", Type: addressTy}},
			Outputs: abi.Arguments{{Name: "", Type: uint256Ty}},
		},
	},
}

var ftsoABI = abi.ABI{
	Methods: map[string]abi.Method{
		"getFeedById": {
			Name:    "getFeedById",
			RawName: "getFeedById",
			Inputs:  abi.Arguments{{Name: "_feedId", Type: bytes21Ty}},
			Outputs: abi.Arguments{
				{Name: "value", Type: uint256Ty},
				{Name: "decimals", Type: int8Ty},
				{Name: "timestamp", Type: uint64Ty},
			},
		},
	},
}

// GuardianRegistry ABI — the on-chain policy + audit ledger. The guard reads
// guards(guardId) to learn the committed policy (active flag, top-up amount)
// and the next nonce to sign.
var registryABI = abi.ABI{
	Methods: map[string]abi.Method{
		"guards": {
			Name:    "guards",
			RawName: "guards",
			Inputs:  abi.Arguments{{Name: "", Type: uint256Ty}},
			Outputs: abi.Arguments{
				{Name: "agentVault", Type: addressTy},
				{Name: "owner", Type: addressTy},
				{Name: "vaultCollateralRatioBIPS", Type: uint64Ty},
				{Name: "topUpAmountWei", Type: uint256Ty},
				{Name: "lastActionNonce", Type: uint64Ty},
				{Name: "createdAt", Type: uint64Ty},
				{Name: "active", Type: boolTy},
			},
		},
	},
}

var (
	addressTy, _ = abi.NewType("address", "", nil)
	uint256Ty, _ = abi.NewType("uint256", "", nil)
	uint64Ty, _  = abi.NewType("uint64", "", nil)
	int8Ty, _    = abi.NewType("int8", "", nil)
	bytes21Ty, _ = abi.NewType("bytes21", "", nil)
	boolTy, _    = abi.NewType("bool", "", nil)
)

const xrpUsdFeedID = "0x015852502f55534400000000000000000000000000"

// readVaultHealth performs the live Coston2 reads the guard bases its
// decision on: liquidation factors, vault collateral, and the FTSO v2
// XRP/USD price.
func readVaultHealth(agentVault string) (types.VaultHealth, error) {
	rpc := os.Getenv("COSTON2_RPC")
	if rpc == "" {
		rpc = "https://coston2-api.flare.network/ext/C/rpc"
	}
	assetManager := os.Getenv("ASSET_MANAGER")
	ftso := os.Getenv("FTSO_V2")

	var h types.VaultHealth
	h.Vault = agentVault

	if assetManager == "" || ftso == "" {
		return h, fmt.Errorf("ASSET_MANAGER and FTSO_V2 env required")
	}

	// Liquidation factors (the danger signal).
	factorsData, err := assetManagerABI.Pack("getAgentLiquidationFactorsAndMaxAmount", common.HexToAddress(agentVault))
	if err != nil {
		return h, fmt.Errorf("packing factors call: %w", err)
	}
	factorsRaw, err := ethCall(rpc, assetManager, factorsData)
	if err != nil {
		return h, fmt.Errorf("factors eth_call: %w", err)
	}
	factorsOut, err := assetManagerABI.Methods["getAgentLiquidationFactorsAndMaxAmount"].Outputs.Unpack(factorsRaw)
	if err != nil {
		return h, fmt.Errorf("unpacking factors: %w", err)
	}
	h.LiqFactorVaultBIPS = factorsOut[0].(*big.Int).String()
	h.LiqFactorPoolBIPS = factorsOut[1].(*big.Int).String()
	h.MaxLiquidationAmount = factorsOut[2].(*big.Int).String()

	// Vault collateral.
	collData, err := assetManagerABI.Pack("getAgentFullVaultCollateral", common.HexToAddress(agentVault))
	if err != nil {
		return h, fmt.Errorf("packing collateral call: %w", err)
	}
	collRaw, err := ethCall(rpc, assetManager, collData)
	if err != nil {
		return h, fmt.Errorf("collateral eth_call: %w", err)
	}
	collOut, err := assetManagerABI.Methods["getAgentFullVaultCollateral"].Outputs.Unpack(collRaw)
	if err != nil {
		return h, fmt.Errorf("unpacking collateral: %w", err)
	}
	h.VaultCollateralWei = collOut[0].(*big.Int).String()

	// FTSO v2 XRP/USD.
	feedData, err := ftsoABI.Pack("getFeedById", common.Hex2Bytes(strings.TrimPrefix(xrpUsdFeedID, "0x")))
	if err != nil {
		return h, fmt.Errorf("packing feed call: %w", err)
	}
	feedRaw, err := ethCall(rpc, ftso, feedData)
	if err != nil {
		return h, fmt.Errorf("feed eth_call: %w", err)
	}
	feedOut, err := ftsoABI.Methods["getFeedById"].Outputs.Unpack(feedRaw)
	if err != nil {
		return h, fmt.Errorf("unpacking feed: %w", err)
	}
	value := feedOut[0].(*big.Int)
	decimals := feedOut[1].(int8)
	h.XrpUsd = formatPrice(value, decimals)

	// Liquidatable = the manager reports non-zero liquidation factors.
	h.Liquidatable = factorsOut[0].(*big.Int).Sign() > 0

	return h, nil
}

// guardPolicy is the on-chain policy the guard reads from the registry.
type guardPolicy struct {
	AgentVault      common.Address
	Owner           common.Address
	RatioBIPS       uint64
	TopUpAmountWei  *big.Int
	LastActionNonce uint64
	CreatedAt       uint64
	Active          bool
}

// readGuard reads the committed policy + nonce for a guard from the registry.
func readGuard(guardId uint64) (guardPolicy, error) {
	var g guardPolicy
	registry := os.Getenv("GUARDIAN_REGISTRY")
	if registry == "" {
		return g, fmt.Errorf("GUARDIAN_REGISTRY env required")
	}
	rpc := os.Getenv("COSTON2_RPC")
	if rpc == "" {
		rpc = "https://coston2-api.flare.network/ext/C/rpc"
	}

	data, err := registryABI.Pack("guards", new(big.Int).SetUint64(guardId))
	if err != nil {
		return g, fmt.Errorf("packing guards call: %w", err)
	}
	raw, err := ethCall(rpc, registry, data)
	if err != nil {
		return g, fmt.Errorf("guards eth_call: %w", err)
	}
	out, err := registryABI.Methods["guards"].Outputs.Unpack(raw)
	if err != nil {
		return g, fmt.Errorf("unpacking guards: %w", err)
	}
	g.AgentVault = out[0].(common.Address)
	g.Owner = out[1].(common.Address)
	g.RatioBIPS = out[2].(uint64)
	g.TopUpAmountWei = out[3].(*big.Int)
	g.LastActionNonce = out[4].(uint64)
	g.CreatedAt = out[5].(uint64)
	g.Active = out[6].(bool)
	return g, nil
}

// ethCall performs a JSON-RPC eth_call against the public RPC.
func ethCall(rpc, to string, data []byte) ([]byte, error) {
	payload := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "eth_call",
		"params": []any{
			map[string]string{"to": to, "data": "0x" + common.Bytes2Hex(data)},
			"latest",
		},
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post(rpc, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out struct {
		Result string `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if out.Error != nil {
		return nil, fmt.Errorf("rpc error: %s", out.Error.Message)
	}
	return common.Hex2Bytes(strings.TrimPrefix(out.Result, "0x")), nil
}

// formatPrice converts a raw FTSO value + decimals into a decimal string.
func formatPrice(value *big.Int, decimals int8) string {
	if decimals == 0 {
		return value.String()
	}
	pow := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	q, r := new(big.Int).QuoRem(value, pow, new(big.Int))
	frac := r.String()
	for len(frac) < int(decimals) {
		frac = "0" + frac
	}
	return fmt.Sprintf("%s.%s", q.String(), frac)
}

// registryDigest reproduces the GuardianRegistry's digest exactly:
// keccak("\x19Ethereum Signed Message:\n32" || keccak(abi.encode(chainId,
// guardId, actionType, amount, nonce))) — abi.encode of five uints is the
// concatenation of five 32-byte big-endian words.
func registryDigest(chainId, guardId, actionType, nonce uint64, amount string) common.Hash {
	words := make([]byte, 0, 160)
	words = append(words, uintWord(chainId)...)
	words = append(words, uintWord(guardId)...)
	words = append(words, uintWord(actionType)...)
	a, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		a = big.NewInt(0)
	}
	words = append(words, leftPadWord(a)...)
	words = append(words, uintWord(nonce)...)

	inner := crypto.Keccak256(words)
	prefixed := append([]byte("\x19Ethereum Signed Message:\n32"), inner...)
	return crypto.Keccak256Hash(prefixed)
}

func uintWord(v uint64) []byte {
	return leftPadWord(new(big.Int).SetUint64(v))
}

func leftPadWord(v *big.Int) []byte {
	b := v.Bytes()
	out := make([]byte, 32)
	copy(out[32-len(b):], b)
	return out
}
