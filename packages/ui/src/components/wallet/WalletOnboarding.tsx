"use client";

/**
 * WalletOnboarding - Complete wallet creation/import flow
 *
 * Multi-step onboarding experience:
 * 1. Choose action (Create / Import)
 * 2. Collect entropy (for create)
 * 3. Show recovery phrase
 * 4. Verify backup (select words)
 * 5. Set password
 *
 * For import:
 * 1. Enter recovery phrase
 * 2. Set password
 */

import { useState, useCallback, useMemo } from "react";
import { clsx } from "clsx";
import { EntropyCollector } from "./EntropyCollector";

/**
 * Minimum password length for security
 * Matches @bitcoinbaby/core MIN_PASSWORD_LENGTH
 */
const MIN_PASSWORD_LENGTH = 8;

type OnboardingStep =
  | "choose"
  | "entropy"
  | "show-mnemonic"
  | "verify-mnemonic"
  | "password"
  | "import-phrase"
  | "complete";

interface WalletOnboardingProps {
  /** Callback when wallet is created */
  onWalletCreated: (mnemonic: string, password: string) => Promise<void>;
  /** Callback when wallet is imported */
  onWalletImported: (mnemonic: string, password: string) => Promise<void>;
  /** Callback to cancel */
  onCancel?: () => void;
  /** Generate mnemonic from entropy */
  generateMnemonic: (entropy: Uint8Array) => string;
  /** Validate mnemonic */
  validateMnemonic: (mnemonic: string) => boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Word display component
 */
function MnemonicWord({
  index,
  word,
  hidden = false,
}: {
  index: number;
  word: string;
  hidden?: boolean;
}) {
  return (
    <div className="bg-pixel-bg-dark px-3 py-2 border-2 border-pixel-border">
      <span className="font-pixel text-[10px] text-pixel-text-muted mr-2">
        {index}.
      </span>
      <span className="font-pixel text-sm text-pixel-text">
        {hidden ? "••••" : word}
      </span>
    </div>
  );
}

/**
 * Step indicator component
 */
function StepIndicator({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div
            className={clsx(
              "w-6 h-6 flex items-center justify-center",
              "border-2 border-black font-pixel text-[8px]",
              i < currentStep
                ? "bg-pixel-success text-black"
                : i === currentStep
                  ? "bg-pixel-primary text-black"
                  : "bg-pixel-bg-light text-pixel-text-muted",
            )}
          >
            {i < currentStep ? "✓" : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div
              className={clsx(
                "w-8 h-0.5 mx-1",
                i < currentStep ? "bg-pixel-success" : "bg-pixel-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function WalletOnboarding({
  onWalletCreated,
  onWalletImported,
  onCancel,
  generateMnemonic,
  validateMnemonic,
  className,
}: WalletOnboardingProps) {
  // State
  const [step, setStep] = useState<OnboardingStep>("choose");
  const [mnemonic, setMnemonic] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [importPhrase, setImportPhrase] = useState("");
  const [verificationIndices, setVerificationIndices] = useState<number[]>([]);
  const [verificationAnswers, setVerificationAnswers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [hasWrittenDown, setHasWrittenDown] = useState(false);
  const [copied, setCopied] = useState(false);

  // Parse mnemonic words
  const mnemonicWords = useMemo(
    () => mnemonic.split(" ").filter((w) => w.length > 0),
    [mnemonic],
  );

  // Step configuration for indicator
  const createSteps = ["Entropy", "Backup", "Verify", "Password"];
  const importSteps = ["Phrase", "Password"];

  const currentStepIndex = useMemo(() => {
    switch (step) {
      case "entropy":
        return 0;
      case "show-mnemonic":
        return 1;
      case "verify-mnemonic":
        return 2;
      case "password":
        return 3;
      case "import-phrase":
        return 0;
      default:
        return 0;
    }
  }, [step]);

  // Handle entropy collection complete
  const handleEntropyComplete = useCallback(
    (entropy: Uint8Array) => {
      try {
        const newMnemonic = generateMnemonic(entropy);
        setMnemonic(newMnemonic);

        // Select random words for verification (3 random positions)
        const words = newMnemonic.split(" ");
        const indices: number[] = [];
        while (indices.length < 3) {
          const idx = Math.floor(Math.random() * words.length);
          if (!indices.includes(idx)) {
            indices.push(idx);
          }
        }
        indices.sort((a, b) => a - b);
        setVerificationIndices(indices);
        setVerificationAnswers(Array(3).fill(""));

        setStep("show-mnemonic");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate");
      }
    },
    [generateMnemonic],
  );

  // Handle continue from mnemonic display
  const handleContinueFromMnemonic = () => {
    if (!hasWrittenDown) {
      setError("Please confirm you have written down your recovery phrase");
      return;
    }
    setError(null);
    setStep("verify-mnemonic");
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  // Handle verification
  const handleVerify = () => {
    const words = mnemonic.split(" ");
    const correct = verificationIndices.every(
      (idx, i) =>
        words[idx].toLowerCase() ===
        verificationAnswers[i].toLowerCase().trim(),
    );

    if (!correct) {
      setError("Words do not match. Please check your recovery phrase.");
      return;
    }

    setError(null);
    setStep("password");
  };

  // Handle password creation and final wallet creation
  const handleCreateWallet = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onWalletCreated(mnemonic, password);
      setStep("complete");
      // SECURITY: Clear sensitive data from memory after success
      setMnemonic("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle import
  const handleImport = async () => {
    // Validate mnemonic
    const cleanPhrase = importPhrase.trim().toLowerCase();
    if (!validateMnemonic(cleanPhrase)) {
      setError("Invalid recovery phrase. Please check and try again.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onWalletImported(cleanPhrase, password);
      setStep("complete");
      // SECURITY: Clear sensitive data from memory after success
      setImportPhrase("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import wallet");
    } finally {
      setIsLoading(false);
    }
  };

  // Render based on current step
  const renderStep = () => {
    switch (step) {
      case "choose":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-pixel text-lg text-pixel-primary mb-2">
                WALLET SETUP
              </h2>
              <p className="font-pixel-body text-sm text-pixel-text-muted">
                Create a new wallet or import an existing one
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setStep("entropy")}
                className={clsx(
                  "w-full p-6 text-left",
                  "border-4 border-black bg-pixel-bg-dark",
                  "shadow-[4px_4px_0_0_#000]",
                  "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
                  "transition-all",
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-pixel-primary border-2 border-black">
                    <span className="font-pixel text-xl text-black">+</span>
                  </div>
                  <div>
                    <h3 className="font-pixel text-sm text-pixel-primary mb-1">
                      CREATE NEW WALLET
                    </h3>
                    <p className="font-pixel-body text-xs text-pixel-text-muted">
                      Generate a new secure wallet with entropy collection
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setStep("import-phrase")}
                className={clsx(
                  "w-full p-6 text-left",
                  "border-4 border-black bg-pixel-bg-dark",
                  "shadow-[4px_4px_0_0_#000]",
                  "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
                  "transition-all",
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-pixel-secondary border-2 border-black">
                    <span className="font-pixel text-xl text-black">↓</span>
                  </div>
                  <div>
                    <h3 className="font-pixel text-sm text-pixel-secondary mb-1">
                      IMPORT EXISTING
                    </h3>
                    <p className="font-pixel-body text-xs text-pixel-text-muted">
                      Restore wallet using your 12 or 24 word recovery phrase
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Info section */}
            <div className="p-4 bg-pixel-bg-light border-2 border-dashed border-pixel-border">
              <h4 className="font-pixel text-[10px] text-pixel-secondary mb-2">
                HOW IT WORKS
              </h4>
              <ul className="space-y-1 font-pixel-body text-xs text-pixel-text-muted">
                <li>• Your wallet is stored locally on your device</li>
                <li>• Encrypted with your password (never sent anywhere)</li>
                <li>• Only you can access it with your recovery phrase</li>
                <li>• Works with Bitcoin Taproot (BIP86)</li>
              </ul>
            </div>

            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full py-2 font-pixel text-[10px] text-pixel-text-muted hover:text-pixel-error transition-colors"
              >
                CANCEL
              </button>
            )}
          </div>
        );

      case "entropy":
        return (
          <div className="space-y-4">
            <StepIndicator steps={createSteps} currentStep={0} />
            <EntropyCollector
              targetBits={128}
              onComplete={handleEntropyComplete}
              onCancel={() => setStep("choose")}
            />
          </div>
        );

      case "show-mnemonic":
        return (
          <div className="space-y-4">
            <StepIndicator steps={createSteps} currentStep={1} />

            <div className="text-center">
              <h3 className="font-pixel text-sm text-pixel-primary mb-2">
                YOUR RECOVERY PHRASE
              </h3>
              <p className="font-pixel-body text-xs text-pixel-text-muted">
                Write these words down in order and keep them safe
              </p>
            </div>

            {/* Warning */}
            <div className="p-3 bg-pixel-error/10 border-2 border-pixel-error">
              <p className="font-pixel text-[8px] text-pixel-error">
                NEVER share these words. Anyone with them can steal your
                Bitcoin!
              </p>
            </div>

            {/* Mnemonic display */}
            <div className="relative">
              <div className="grid grid-cols-3 gap-2">
                {mnemonicWords.map((word, i) => (
                  <MnemonicWord
                    key={i}
                    index={i + 1}
                    word={word}
                    hidden={!showMnemonic}
                  />
                ))}
              </div>

              {/* Show/Hide overlay */}
              {!showMnemonic && (
                <div className="absolute inset-0 flex items-center justify-center bg-pixel-bg-dark/80">
                  <button
                    onClick={() => setShowMnemonic(true)}
                    className="px-6 py-3 font-pixel text-sm bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000]"
                  >
                    REVEAL WORDS
                  </button>
                </div>
              )}
            </div>

            {/* Copy all words button */}
            {showMnemonic && (
              <button
                onClick={handleCopyAll}
                className="w-full py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-2 border-pixel-border hover:bg-pixel-bg-medium transition-colors"
                type="button"
              >
                {copied ? "COPIED!" : "COPY ALL WORDS"}
              </button>
            )}

            {/* Checkbox confirmation */}
            <label className="flex items-center gap-3 p-3 bg-pixel-bg-light border-2 border-pixel-border cursor-pointer">
              <input
                type="checkbox"
                checked={hasWrittenDown}
                onChange={(e) => setHasWrittenDown(e.target.checked)}
                className="w-5 h-5 accent-pixel-primary"
              />
              <span className="font-pixel text-[10px] text-pixel-text">
                I have written down my recovery phrase safely
              </span>
            </label>

            {error && (
              <p className="font-pixel text-[8px] text-pixel-error text-center">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("choose")}
                className="px-4 py-3 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black"
              >
                BACK
              </button>
              <button
                onClick={handleContinueFromMnemonic}
                disabled={!showMnemonic}
                className="flex-1 py-3 font-pixel text-[10px] bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000] disabled:opacity-50"
              >
                CONTINUE
              </button>
            </div>
          </div>
        );

      case "verify-mnemonic":
        return (
          <div className="space-y-4">
            <StepIndicator steps={createSteps} currentStep={2} />

            <div className="text-center">
              <h3 className="font-pixel text-sm text-pixel-primary mb-2">
                VERIFY YOUR BACKUP
              </h3>
              <p className="font-pixel-body text-xs text-pixel-text-muted">
                Enter the requested words to confirm you saved them
              </p>
            </div>

            <div className="space-y-4">
              {verificationIndices.map((wordIndex, i) => (
                <div key={wordIndex}>
                  <label className="font-pixel text-[10px] text-pixel-text-muted block mb-1">
                    Word #{wordIndex + 1}
                  </label>
                  <input
                    type="text"
                    value={verificationAnswers[i]}
                    onChange={(e) => {
                      const newAnswers = [...verificationAnswers];
                      newAnswers[i] = e.target.value;
                      setVerificationAnswers(newAnswers);
                    }}
                    className="w-full px-3 py-2 font-pixel text-sm bg-pixel-bg-dark border-2 border-black text-pixel-text"
                    placeholder={`Enter word #${wordIndex + 1}`}
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>

            {error && (
              <p className="font-pixel text-[8px] text-pixel-error text-center">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError(null);
                  setStep("show-mnemonic");
                }}
                className="px-4 py-3 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black"
              >
                BACK
              </button>
              <button
                onClick={handleVerify}
                disabled={verificationAnswers.some((a) => a.trim() === "")}
                className="flex-1 py-3 font-pixel text-[10px] bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000] disabled:opacity-50"
              >
                VERIFY
              </button>
            </div>
          </div>
        );

      case "password":
        return (
          <div className="space-y-4">
            <StepIndicator steps={createSteps} currentStep={3} />

            <div className="text-center">
              <h3 className="font-pixel text-sm text-pixel-primary mb-2">
                SET PASSWORD
              </h3>
              <p className="font-pixel-body text-xs text-pixel-text-muted">
                Create a strong password to encrypt your wallet
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-pixel text-[10px] text-pixel-text-muted block mb-1">
                  Password (min {MIN_PASSWORD_LENGTH} characters)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 font-pixel text-sm bg-pixel-bg-dark border-2 border-black text-pixel-text"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="font-pixel text-[10px] text-pixel-text-muted block mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 font-pixel text-sm bg-pixel-bg-dark border-2 border-black text-pixel-text"
                  placeholder="Confirm password"
                />
              </div>
            </div>

            <div className="p-3 bg-pixel-bg-light border-2 border-pixel-border">
              <p className="font-pixel text-[8px] text-pixel-text-muted">
                This password encrypts your wallet on this device. You will need
                it to unlock your wallet each time.
              </p>
            </div>

            {error && (
              <p className="font-pixel text-[8px] text-pixel-error text-center">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError(null);
                  setStep("verify-mnemonic");
                }}
                disabled={isLoading}
                className="px-4 py-3 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black disabled:opacity-50"
              >
                BACK
              </button>
              <button
                onClick={handleCreateWallet}
                disabled={isLoading || password.length < MIN_PASSWORD_LENGTH}
                className="flex-1 py-3 font-pixel text-[10px] bg-pixel-success text-black border-4 border-black shadow-[4px_4px_0_0_#000] disabled:opacity-50"
              >
                {isLoading ? "CREATING..." : "CREATE WALLET"}
              </button>
            </div>
          </div>
        );

      case "import-phrase":
        return (
          <div className="space-y-4">
            <StepIndicator steps={importSteps} currentStep={0} />

            <div className="text-center">
              <h3 className="font-pixel text-sm text-pixel-secondary mb-2">
                IMPORT RECOVERY PHRASE
              </h3>
              <p className="font-pixel-body text-xs text-pixel-text-muted">
                Enter your 12 or 24 word recovery phrase
              </p>
            </div>

            <div>
              <textarea
                value={importPhrase}
                onChange={(e) => setImportPhrase(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 font-pixel text-sm bg-pixel-bg-dark border-2 border-black text-pixel-text resize-none"
                placeholder="word1 word2 word3 ..."
              />
              <p className="font-pixel text-[8px] text-pixel-text-muted mt-1">
                Words separated by spaces
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-pixel text-[10px] text-pixel-text-muted block mb-1">
                  New Password (min {MIN_PASSWORD_LENGTH} characters)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 font-pixel text-sm bg-pixel-bg-dark border-2 border-black text-pixel-text"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="font-pixel text-[10px] text-pixel-text-muted block mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 font-pixel text-sm bg-pixel-bg-dark border-2 border-black text-pixel-text"
                  placeholder="Confirm password"
                />
              </div>
            </div>

            {error && (
              <p className="font-pixel text-[8px] text-pixel-error text-center">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError(null);
                  setImportPhrase("");
                  setPassword("");
                  setConfirmPassword("");
                  setStep("choose");
                }}
                disabled={isLoading}
                className="px-4 py-3 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black disabled:opacity-50"
              >
                BACK
              </button>
              <button
                onClick={handleImport}
                disabled={
                  isLoading ||
                  importPhrase.trim().split(/\s+/).length < 12 ||
                  password.length < MIN_PASSWORD_LENGTH
                }
                className="flex-1 py-3 font-pixel text-[10px] bg-pixel-secondary text-black border-4 border-black shadow-[4px_4px_0_0_#000] disabled:opacity-50"
              >
                {isLoading ? "IMPORTING..." : "IMPORT WALLET"}
              </button>
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="text-center py-12 space-y-6">
            <div className="font-pixel text-6xl text-pixel-success">✓</div>
            <div>
              <h3 className="font-pixel text-lg text-pixel-success mb-2">
                WALLET READY!
              </h3>
              <p className="font-pixel-body text-sm text-pixel-text-muted">
                Your wallet has been set up successfully
              </p>
            </div>
            <div className="p-4 bg-pixel-bg-light border-2 border-pixel-success">
              <p className="font-pixel text-[10px] text-pixel-text">
                Remember: Your recovery phrase is the only way to restore your
                wallet. Keep it safe!
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className={clsx(
        "bg-pixel-bg-medium border-4 border-pixel-border p-6",
        "shadow-[8px_8px_0_0_#000]",
        className,
      )}
    >
      {renderStep()}
    </div>
  );
}

export default WalletOnboarding;
