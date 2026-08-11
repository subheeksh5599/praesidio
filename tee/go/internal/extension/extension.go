package extension

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	"github.com/flare-foundation/go-flare-common/pkg/tee/structs"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"
	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

type Extension struct {
	mu     sync.RWMutex
	Server *http.Server

	lastCheckVault  string
	lastDecision    string
	checksPerformed uint64
	actionsSigned   uint64
}

// New sets up the PRAESIDIO guard server.
func New(extensionPort, signPort int) *Extension {
	e := &Extension{}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /state", e.stateHandler)
	mux.HandleFunc("POST /action", e.actionHandler)

	e.Server = &http.Server{Addr: fmt.Sprintf(":%d", extensionPort), Handler: mux}
	return e
}

func (e *Extension) stateHandler(w http.ResponseWriter, r *http.Request) {
	e.mu.RLock()
	stateResponse := types.StateResponse{
		StateVersion: teeutils.ToHash(config.Version),
		State: types.State{
			LastCheckVault:  e.lastCheckVault,
			LastDecision:    e.lastDecision,
			ChecksPerformed: e.checksPerformed,
			ActionsSigned:   e.actionsSigned,
		},
	}
	e.mu.RUnlock()

	err := json.NewEncoder(w).Encode(stateResponse)
	if err != nil {
		http.Error(w, fmt.Sprintf("sending response: %v", err), http.StatusInternalServerError)
		return
	}
}

// actionHandler is boilerplate — do not modify.
func (e *Extension) actionHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var action teetypes.Action
	if err := json.NewDecoder(r.Body).Decode(&action); err != nil {
		http.Error(w, fmt.Sprintf("decoding action: %v", err), http.StatusBadRequest)
		return
	}

	code, body := e.processAction(action)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(body)
}

func (e *Extension) processAction(action teetypes.Action) (int, []byte) {
	dataFixed, err := processorutils.Parse[instruction.DataFixed](action.Data.Message)
	if err != nil {
		return http.StatusBadRequest, []byte(fmt.Sprintf("decoding fixed data: %v", err))
	}

	switch {
	case dataFixed.OPType == teeutils.ToHash(config.OPTypeGuard):
		return e.processGuard(action, dataFixed)

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op type: received %s, expected %s",
			dataFixed.OPType.Hex(), teeutils.ToHash(config.OPTypeGuard).Hex(),
		))
	}
}

// processGuard routes GUARD instructions by OPCommand.
func (e *Extension) processGuard(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandCheckVault):
		ar := e.checkVault(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected %s",
			df.OPCommand.Hex(), teeutils.ToHash(config.OPCommandCheckVault).Hex(),
		))
	}
}

// checkVault reads the agent vault's live health from Coston2, applies the
// defense policy and — when danger is detected — signs the attestable action
// record for the GuardianRegistry.
func (e *Extension) checkVault(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	var req types.CheckVaultRequest
	dec := json.NewDecoder(bytes.NewReader(df.OriginalMessage))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}
	if !common.IsHexAddress(req.AgentVault) {
		return buildResult(action, df, nil, 0, fmt.Errorf("agentVault must be a valid address"))
	}

	health, err := readVaultHealth(req.AgentVault)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("reading vault health: %w", err))
	}

	// Decision: the FAssets manager reports non-zero liquidation factors when
	// the agent is liquidatable — that is the guardian's danger signal.
	decision := "WATCH"
	healthy := true
	liq, _ := strconv.ParseUint(health.LiqFactorVaultBIPS, 10, 64)
	if liq > 0 {
		decision = "TOP_UP_REQUIRED"
		healthy = false
	}

	resp := types.CheckVaultResponse{
		Healthy:  healthy,
		Health:   health,
		Decision: decision,
	}

	e.mu.Lock()
	e.lastCheckVault = req.AgentVault
	e.lastDecision = decision
	e.checksPerformed++
	e.mu.Unlock()

	if !healthy {
		signed, err := signTopUpAction(req.GuardId, health.MaxLiquidationAmount)
		if err != nil {
			return buildResult(action, df, nil, 0, fmt.Errorf("signing action: %w", err))
		}
		resp.Signed = signed
		e.mu.Lock()
		e.actionsSigned++
		e.mu.Unlock()
	}

	data, _ := json.Marshal(resp)
	return buildResult(action, df, data, 1, nil)
}

// signTopUpAction produces the ECDSA signature the GuardianRegistry verifies:
// keccak("\x19Ethereum Signed Message:\n32" || keccak(abi.encode(chainId,
// guardId, actionType, amount, nonce))). The enclave key comes from
// GUARDIAN_KEY (env, injected into the confidential VM).
func signTopUpAction(guardId uint64, maxLiquidationAmount string) (*types.SignedAction, error) {
	keyHex := os.Getenv("GUARDIAN_KEY")
	if keyHex == "" {
		return nil, fmt.Errorf("GUARDIAN_KEY not set inside the enclave")
	}
	priv, err := crypto.HexToECDSA(strings.TrimPrefix(keyHex, "0x"))
	if err != nil {
		return nil, fmt.Errorf("parsing enclave key: %w", err)
	}

	chainId, err := strconv.ParseUint(os.Getenv("CHAIN_ID"), 10, 64)
	if err != nil || chainId == 0 {
		chainId = 114 // Coston2
	}
	nonce := uint64(1) // per-guard nonce enforced by the registry; the relayer maps it

	digest := registryDigest(chainId, guardId, 1, nonce, maxLiquidationAmount)
	sig, err := crypto.Sign(digest.Bytes(), priv)
	if err != nil {
		return nil, fmt.Errorf("signing digest: %w", err)
	}

	return &types.SignedAction{
		GuardId:    guardId,
		ActionType: 1,
		Amount:     maxLiquidationAmount,
		Nonce:      nonce,
		ChainId:    chainId,
		Digest:     digest.Hex(),
		Signature:  "0x" + hex.EncodeToString(sig),
		Signer:     crypto.PubkeyToAddress(priv.PublicKey).Hex(),
	}, nil
}
