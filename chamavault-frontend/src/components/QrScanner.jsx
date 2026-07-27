import { useEffect, useRef, useState } from "react";

const SCANNER_ELEMENT_ID = "chamavault-qr-scanner";

/**
 * Opens the device camera and scans for a QR code containing a Stellar
 * address. Calls onResult(text) once on the first successful decode, then
 * stops the camera — the parent decides what to do next (fill a field,
 * close this view).
 */
function QrScanner({ onResult, onClose }) {
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let cancelled = false;
    let instance = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        instance = new Html5Qrcode(SCANNER_ELEMENT_ID);
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (instance) {
              instance.stop().then(() => instance.clear()).catch(() => {});
            }
            onResultRef.current(decodedText.trim());
          },
          () => {
            /* per-frame "no QR found" — expected while aiming, ignore */
          }
        );
        if (!cancelled) setStarting(false);
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (instance) {
        instance.stop().then(() => instance.clear()).catch(() => {});
      }
    };
  }, []);

  return (
    <div className="qr-scanner">
      <div className="qr-scanner__header">
        <span>Changanua QR / Scan QR</span>
        <button type="button" className="qr-scanner__close" onClick={onClose} aria-label="Funga / Close">
          ✕
        </button>
      </div>
      {starting && !error && (
        <p className="form-hint">Inafungua kamera... / Opening camera...</p>
      )}
      {error && (
        <p className="field-error">
          Imeshindwa kufikia kamera / Could not access camera — tumia sanduku
          la kuandika hapo chini / use the text field below instead.
        </p>
      )}
      <div id={SCANNER_ELEMENT_ID} className="qr-scanner__viewport" />
    </div>
  );
}

export default QrScanner;
