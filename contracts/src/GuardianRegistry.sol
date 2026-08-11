// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAssetManager} from "./interfaces/IAssetManager.sol";

/// @title PRAESIDIO — GuardianRegistry
/// @notice The policy + audit ledger for the confidential FAssets vault guardian.
///
/// The guardian logic runs inside a Flare Confidential Compute enclave (the
/// "TEE"). The enclave holds the agent's work key, watches vault health, and
/// executes defensive actions directly on the FAssets AssetManager. This
/// contract is the on-chain spine that makes the guardian TRUSTWORTHY:
///
///   1. POLICY   — the agent registers their vault and commits the defense
///                 policy (danger threshold + top-up amount) on-chain.
///   2. ACTIONS  — every action the enclave executes is signed with the
///                 enclave key and posted here as an immutable, attestable
///                 audit record (who acted, what, when, nonce).
///   3. VERIFY   — anyone (collateral providers, challengers) can read the
///                 ledger and confirm the guardian behaved per policy.
///
/// The contract holds NO funds. It is the policy + proof layer; the money
/// moves on the AssetManager.
contract GuardianRegistry {
    error NotOwner();
    error NotGuardianSigner();
    error NotAgentOwner();
    error UnknownGuard();
    error DuplicateGuard();
    error Paused();
    error InvalidNonce();
    error InvalidSignature();
    error InvalidActionType();
    error ZeroAddress();
    error ZeroAmount();

    event PauseChanged(bool paused);
    event GuardianSignerChanged(address indexed signer);
    event GuardRegistered(
        uint256 indexed guardId, address indexed agentVault, address indexed owner
    );
    event GuardActivated(uint256 indexed guardId);
    event GuardDeactivated(uint256 indexed guardId);
    event PolicyChanged(
        uint256 indexed guardId, uint64 vaultCollateralRatioBIPS, uint256 topUpAmountWei
    );
    event ActionPosted(
        uint256 indexed guardId, uint8 actionType, uint256 amount, uint64 nonce, uint256 timestamp
    );

    /// @notice Action types the enclave can record.
    uint8 public constant ACTION_HEARTBEAT = 0;
    uint8 public constant ACTION_VAULT_TOP_UP = 1;
    uint8 public constant ACTION_REDEMPTION_HANDLED = 2;

    /// @notice A registered vault under guardianship.
    struct Guard {
        address agentVault; ///< the FAssets agent vault
        address owner; ///< management address that registered the vault
        uint64 vaultCollateralRatioBIPS; ///< danger threshold (BIPS of collateral ratio)
        uint256 topUpAmountWei; ///< top-up the guardian executes when the threshold trips
        uint64 lastActionNonce; ///< replay protection per guard
        uint64 createdAt;
        bool active;
    }

    /// @notice One attestable guardian action.
    struct Action {
        uint8 actionType;
        uint256 amount;
        uint64 nonce;
        uint64 timestamp;
    }

    address public immutable assetManager;
    address public owner;
    address public guardianSigner;
    bool public paused;

    uint256 public guardCount;
    /// @dev guardId -> Guard
    mapping(uint256 => Guard) public guards;
    /// @dev agentVault -> guardId
    mapping(address => uint256) public guardIdOfVault;
    /// @dev guardId -> actions (FIFO)
    mapping(uint256 => Action[]) private _actions;
    /// @dev guardId -> action index -> nonce used
    mapping(uint256 => mapping(uint256 => bool)) private _nonceUsed;

    constructor(address _assetManager) {
        if (_assetManager == address(0)) revert ZeroAddress();
        assetManager = _assetManager;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier notPaused() {
        if (paused) revert Paused();
        _;
    }

    /// @notice Set the enclave key allowed to post actions.
    function setGuardianSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        guardianSigner = _signer;
        emit GuardianSignerChanged(_signer);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseChanged(_paused);
    }

    /// @notice Register an agent vault under guardianship. Only the vault's
    /// management address (verified against the AssetManager) may register.
    function registerAgentVault(
        address _agentVault,
        uint64 _vaultCollateralRatioBIPS,
        uint256 _topUpAmountWei
    ) external notPaused returns (uint256 guardId) {
        if (_agentVault == address(0)) revert ZeroAddress();
        if (guardIdOfVault[_agentVault] != 0) revert DuplicateGuard();
        if (IAssetManager(assetManager).getAgentVaultOwner(_agentVault) != msg.sender) {
            revert NotAgentOwner();
        }
        if (_vaultCollateralRatioBIPS == 0) revert ZeroAmount();
        if (_topUpAmountWei == 0) revert ZeroAmount();

        guardId = ++guardCount;
        guards[guardId] = Guard({
            agentVault: _agentVault,
            owner: msg.sender,
            vaultCollateralRatioBIPS: _vaultCollateralRatioBIPS,
            topUpAmountWei: _topUpAmountWei,
            lastActionNonce: 0,
            createdAt: uint64(block.timestamp),
            active: true
        });
        guardIdOfVault[_agentVault] = guardId;
        emit GuardRegistered(guardId, _agentVault, msg.sender);
    }

    /// @notice Update the defense policy.
    function setPolicy(uint256 _guardId, uint64 _vaultCollateralRatioBIPS, uint256 _topUpAmountWei)
        external
        notPaused
    {
        Guard storage g = guards[_guardId];
        if (g.agentVault == address(0)) revert UnknownGuard();
        if (msg.sender != g.owner) revert NotAgentOwner();
        if (_vaultCollateralRatioBIPS == 0 || _topUpAmountWei == 0) revert ZeroAmount();
        g.vaultCollateralRatioBIPS = _vaultCollateralRatioBIPS;
        g.topUpAmountWei = _topUpAmountWei;
        emit PolicyChanged(_guardId, _vaultCollateralRatioBIPS, _topUpAmountWei);
    }

    function setGuardActive(uint256 _guardId, bool _active) external notPaused {
        Guard storage g = guards[_guardId];
        if (g.agentVault == address(0)) revert UnknownGuard();
        if (msg.sender != g.owner) revert NotAgentOwner();
        g.active = _active;
        if (_active) {
            emit GuardActivated(_guardId);
        } else {
            emit GuardDeactivated(_guardId);
        }
    }

    /// @notice Post an attestable guardian action. Only the enclave key.
    /// The signature binds (chainId, guardId, actionType, amount, nonce) so the
    /// record cannot be forged or replayed.
    function postAction(
        uint256 _guardId,
        uint8 _actionType,
        uint256 _amount,
        uint64 _nonce,
        bytes calldata _signature
    ) external notPaused {
        Guard storage g = guards[_guardId];
        if (g.agentVault == address(0)) revert UnknownGuard();
        if (_actionType > ACTION_REDEMPTION_HANDLED) revert InvalidActionType();
        if (_nonce <= g.lastActionNonce) revert InvalidNonce();

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, _guardId, _actionType, _amount, _nonce))
            )
        );
        (address recovered,) = _recover(digest, _signature);
        if (recovered != guardianSigner) revert InvalidSignature();

        g.lastActionNonce = _nonce;
        _actions[_guardId].push(
            Action({
                actionType: _actionType,
                amount: _amount,
                nonce: _nonce,
                timestamp: uint64(block.timestamp)
            })
        );
        emit ActionPosted(_guardId, _actionType, _amount, _nonce, block.timestamp);
    }

    /// @notice Read the full attestable ledger for a guard.
    function getActions(uint256 _guardId) external view returns (Action[] memory) {
        return _actions[_guardId];
    }

    function actionsCount(uint256 _guardId) external view returns (uint256) {
        return _actions[_guardId].length;
    }

    /// @dev ECDSA recover with signature malleability guard (low-s only).
    function _recover(bytes32 _digest, bytes memory _signature)
        internal
        pure
        returns (address, bytes32)
    {
        if (_signature.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(_signature, 0x20))
            s := mload(add(_signature, 0x40))
            v := byte(0, mload(add(_signature, 0x60)))
        }
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignature();
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();
        return (ecrecover(_digest, v, r, s), s);
    }
}
