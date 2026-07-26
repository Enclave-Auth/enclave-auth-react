import { Button, ErrorText, Field, Muted, WarningBanner } from "./ui.js";

export function RecoveryKeyWordGrid({ words }: { words: string[] }) {
  return (
    <div className="enclave-auth__word-grid">
      {words.map((word, i) => (
        <div key={`w-${i}`} className="enclave-auth__word-cell">
          <span className="enclave-auth__word-index">{i + 1}</span>
          <span className="enclave-auth__word-text">{word}</span>
        </div>
      ))}
    </div>
  );
}

export function RecoveryKeyDisplayStep({
  words,
  error,
  onCopy,
  onContinue,
}: {
  words: string[];
  error?: string | null;
  onCopy: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <WarningBanner>
        Save this now — your previous Recovery Key will stop working once
        rotation completes. We cannot show this again.
      </WarningBanner>
      <RecoveryKeyWordGrid words={words} />
      <Button label="Copy all" variant="ghost" onClick={onCopy} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="I've saved it — continue" onClick={onContinue} />
    </>
  );
}

export function RecoveryKeyConfirmStep({
  confirmIndices,
  confirmInputs,
  onInputChange,
  error,
  busy,
  onConfirm,
  onShowAgain,
}: {
  confirmIndices: number[];
  confirmInputs: Record<number, string>;
  onInputChange: (index: number, value: string) => void;
  error?: string | null;
  busy?: boolean;
  onConfirm: () => void;
  onShowAgain: () => void;
}) {
  return (
    <>
      <Muted>
        Enter the words at the numbers below to confirm you saved them.
      </Muted>
      {confirmIndices.map((idx) => (
        <Field
          key={`c-${idx}`}
          label={`Enter word #${idx + 1}`}
          placeholder={`Word #${idx + 1}`}
          value={confirmInputs[idx] ?? ""}
          onChange={(e) => onInputChange(idx, e.target.value)}
          autoComplete="off"
        />
      ))}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        label={busy ? "Working…" : "Confirm"}
        onClick={onConfirm}
        disabled={
          busy ||
          confirmIndices.some((i) => !(confirmInputs[i] ?? "").trim())
        }
      />
      <Button
        label="Show Recovery Key again"
        variant="ghost"
        onClick={onShowAgain}
      />
    </>
  );
}
