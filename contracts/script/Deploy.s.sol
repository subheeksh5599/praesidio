// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Script } from "forge-std/Script.sol";
import { GuardianRegistry } from "../src/GuardianRegistry.sol";

/// @dev Minimal fAsset interface: the AssetManager entry point.
interface IFAsset {
    function assetManager() external view returns (address);
}

/// @notice Deploy VIGILUM's GuardianRegistry.
/// The AssetManager diamond is resolved at runtime from the fAsset token's
/// `assetManager()` — no hardcoded addresses.
/// Usage:
///   FASSET=<fasset-token> forge script script/Deploy.s.sol --rpc-url <rpc> \
///     --private-key <key> --broadcast
/// Optional: GUARDIAN_SIGNER=<enclave-key-address> to set the TEE signer in the same tx.
contract Deploy is Script {
    function run() external returns (GuardianRegistry) {
        address fAsset = vm.envAddress("FASSET");
        address assetManager = IFAsset(fAsset).assetManager();
        require(assetManager != address(0), "assetManager not resolved");

        vm.startBroadcast();
        GuardianRegistry registry = new GuardianRegistry(assetManager);
        if (vm.envOr("GUARDIAN_SIGNER", address(0)) != address(0)) {
            registry.setGuardianSigner(vm.envAddress("GUARDIAN_SIGNER"));
        }
        vm.stopBroadcast();

        console2.log("GuardianRegistry deployed at:", address(registry));
        console2.log("AssetManager resolved:", assetManager);
        console2.log("Deployer:", msg.sender);
    }
}
