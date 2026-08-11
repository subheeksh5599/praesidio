// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {GuardianRegistry} from "../src/GuardianRegistry.sol";

/// @dev TEST-ONLY fixture — simulates the AssetManager reads the registry uses.
/// The production path reads the real Coston2 diamond; this mock exists only
/// to test revert paths and access control locally.
contract MockAssetManager {
    mapping(address => address) public vaultOwner;
    mapping(address => uint256) public vaultCollateral;

    function setVaultOwner(address vault, address owner) external {
        vaultOwner[vault] = owner;
    }

    function getAgentVaultOwner(address vault) external view returns (address) {
        return vaultOwner[vault];
    }

    function getAgentFullVaultCollateral(address vault) external view returns (uint256) {
        return vaultCollateral[vault];
    }
}

contract GuardianRegistryTest is Test {
    GuardianRegistry internal registry;
    MockAssetManager internal assetManager;

    address internal agentOwner = address(0xA11CE);
    address internal vault = address(0xCA11C0DE);
    address internal signer;
    uint256 internal signerPk = 0xA11CE5;

    uint64 internal constant RATIO = 11000; // 110% collateral ratio threshold
    uint256 internal constant TOP_UP = 1 ether;

    // Mirrors GuardianRegistry's action types (avoid via_ir ADL quirk).
    uint8 internal constant ACTION_HEARTBEAT = 0;
    uint8 internal constant ACTION_VAULT_TOP_UP = 1;
    uint8 internal constant ACTION_REDEMPTION_HANDLED = 2;

    function setUp() public {
        signer = vm.addr(signerPk);
        assetManager = new MockAssetManager();
        registry = new GuardianRegistry(address(assetManager));
        registry.setGuardianSigner(signer);
        vm.prank(agentOwner);
        assetManager.setVaultOwner(vault, agentOwner);
    }

    /* ---------- registration ---------- */

    function testRegisterAgentVault() public {
        vm.prank(agentOwner);
        uint256 id = registry.registerAgentVault(vault, RATIO, TOP_UP);
        assertEq(id, 1);
        (address v, address o, uint64 ratio, uint256 topUp, uint64 nonce,, bool active) =
            registry.guards(id);
        assertEq(v, vault);
        assertEq(o, agentOwner);
        assertEq(ratio, RATIO);
        assertEq(topUp, TOP_UP);
        assertEq(nonce, 0);
        assertTrue(active);
        assertEq(registry.guardIdOfVault(vault), 1);
    }

    function testRegisterRevertsWhenNotVaultOwner() public {
        vm.expectRevert(GuardianRegistry.NotAgentOwner.selector);
        registry.registerAgentVault(vault, RATIO, TOP_UP); // msg.sender is not the vault owner
    }

    function testRegisterRevertsDuplicate() public {
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
        vm.expectRevert(GuardianRegistry.DuplicateGuard.selector);
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
    }

    function testRegisterRevertsZeroThreshold() public {
        vm.expectRevert(GuardianRegistry.ZeroAmount.selector);
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, 0, TOP_UP);
    }

    /* ---------- policy ---------- */

    function testSetPolicy() public {
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
        vm.prank(agentOwner);
        registry.setPolicy(1, 12000, 2 ether);
        (,, uint64 ratio, uint256 topUp,,,) = registry.guards(1);
        assertEq(ratio, 12000);
        assertEq(topUp, 2 ether);
    }

    function testSetPolicyRevertsNonOwner() public {
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
        vm.expectRevert(GuardianRegistry.NotAgentOwner.selector);
        registry.setPolicy(1, 12000, 2 ether);
    }

    function testSetPolicyRevertsUnknownGuard() public {
        vm.expectRevert(GuardianRegistry.UnknownGuard.selector);
        vm.prank(agentOwner);
        registry.setPolicy(99, 12000, 2 ether);
    }

    /* ---------- actions ---------- */

    function _signAction(uint256 id, uint8 actionType, uint256 amount, uint64 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 inner = keccak256(abi.encode(block.chainid, id, actionType, amount, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testPostAction() public {
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
        bytes memory sig = _signAction(1, ACTION_VAULT_TOP_UP, TOP_UP, 1);
        registry.postAction(1, ACTION_VAULT_TOP_UP, TOP_UP, 1, sig);

        GuardianRegistry.Action[] memory actions = registry.getActions(1);
        assertEq(actions.length, 1);
        assertEq(actions[0].actionType, ACTION_VAULT_TOP_UP);
        assertEq(actions[0].amount, TOP_UP);
        assertEq(actions[0].nonce, 1);
        (,,,, uint64 nonce,,) = registry.guards(1);
        assertEq(nonce, 1);
    }

    function testPostActionRevertsReplay() public {
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
        bytes memory sig = _signAction(1, ACTION_HEARTBEAT, 0, 1);
        registry.postAction(1, ACTION_HEARTBEAT, 0, 1, sig);
        vm.expectRevert(GuardianRegistry.InvalidNonce.selector);
        registry.postAction(1, ACTION_HEARTBEAT, 0, 1, sig);
    }

    function testPostActionRevertsBadSigner() public {
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
        uint256 otherPk = 0xB0B0;
        bytes32 digest = keccak256(abi.encode(block.chainid, 1, uint8(0), uint256(0), uint64(1)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(otherPk, digest);
        vm.expectRevert(GuardianRegistry.InvalidSignature.selector);
        registry.postAction(1, ACTION_HEARTBEAT, 0, 1, abi.encodePacked(r, s, v));
    }

    function testPostActionRevertsInvalidType() public {
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
        bytes memory sig = _signAction(1, 9, 0, 1);
        vm.expectRevert(GuardianRegistry.InvalidActionType.selector);
        registry.postAction(1, 9, 0, 1, sig);
    }

    function testPostActionRevertsUnknownGuard() public {
        bytes memory sig = _signAction(99, ACTION_HEARTBEAT, 0, 1);
        vm.expectRevert(GuardianRegistry.UnknownGuard.selector);
        registry.postAction(99, ACTION_HEARTBEAT, 0, 1, sig);
    }

    function testPostActionRevertsMalleableSignature() public {
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
        bytes32 digest = keccak256(abi.encode(block.chainid, 1, uint8(0), uint256(0), uint64(1)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        // Flip s to the high range (malleability).
        bytes32 highS = bytes32(
            uint256(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141) - uint256(s)
        );
        bytes memory malleable = abi.encodePacked(r, highS, v);
        vm.expectRevert(GuardianRegistry.InvalidSignature.selector);
        registry.postAction(1, ACTION_HEARTBEAT, 0, 1, malleable);
    }

    /* ---------- pause / signer ---------- */

    function testPauseBlocksActions() public {
        vm.prank(agentOwner);
        registry.registerAgentVault(vault, RATIO, TOP_UP);
        registry.setPaused(true);
        bytes memory sig = _signAction(1, ACTION_HEARTBEAT, 0, 1);
        vm.expectRevert(GuardianRegistry.Paused.selector);
        registry.postAction(1, ACTION_HEARTBEAT, 0, 1, sig);
    }

    function testSetPausedOnlyOwner() public {
        vm.expectRevert(GuardianRegistry.NotOwner.selector);
        vm.prank(vault);
        registry.setPaused(true);
    }

    function testSetSignerOnlyOwner() public {
        vm.expectRevert(GuardianRegistry.NotOwner.selector);
        vm.prank(vault);
        registry.setGuardianSigner(address(0xDEAD));
    }

    function testSetSignerZeroAddress() public {
        vm.expectRevert(GuardianRegistry.ZeroAddress.selector);
        registry.setGuardianSigner(address(0));
    }

    function testConstructorZeroAssetManager() public {
        vm.expectRevert(GuardianRegistry.ZeroAddress.selector);
        new GuardianRegistry(address(0));
    }
}
