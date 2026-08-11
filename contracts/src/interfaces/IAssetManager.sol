// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Minimal FAssets AssetManager interface (Coston2 diamond).
/// Only the reads VIGILUM needs. Function signatures match the facets of the
/// AssetManager diamond (flare-foundation/fassets).
interface IAssetManager {
    /// @dev Agent vault owner's management address (immutable).
    function getAgentVaultOwner(address _agentVault) external view returns (address);

    /// @dev Total vault collateral of the agent (vault collateral token wei).
    function getAgentFullVaultCollateral(address _agentVault) external view returns (uint256);

    /// @dev Liquidation factors are ZERO while the agent is healthy and become
    /// non-zero when the agent is liquidatable. This is the guardian's danger signal.
    function getAgentLiquidationFactorsAndMaxAmount(address _agentVault)
        external
        view
        returns (
            uint256 liquidationPaymentFactorVaultBIPS,
            uint256 liquidationPaymentFactorPoolBIPS,
            uint256 maxLiquidationAmountUBA
        );

    /// @dev Agent's vault collateral token.
    function getAgentVaultCollateralToken(address _agentVault) external view returns (address);
}
