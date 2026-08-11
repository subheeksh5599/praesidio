package config

import (
	"os"
	"strconv"
	"time"
)

// VIGILUM operation types.
const (
	OPTypeGuard         = "GUARD"
	OPCommandCheckVault = "CHECK_VAULT"
	OPCommandTopUp      = "EXECUTE_TOP_UP"

	TimeoutShutdown = 5 * time.Second
)

// Defaults.
var (
	ExtensionPort = 8080
	SignPort      = 9090
)

// Environment variables override defaults.
func init() {
	if v := os.Getenv("EXTENSION_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			ExtensionPort = p
		}
	}
	if v := os.Getenv("SIGN_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			SignPort = p
		}
	}
}

// Version is embedded at build time (see Makefile). It must be bumped on
// every change so the on-chain registry observes a new state version.
var Version = "0.1.0-vigilum"
