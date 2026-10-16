/**
 * Ambient shell background: four drifting blurred blobs plus a fine grain
 * overlay. Ported from the React 18 UI concept. Purely decorative.
 */
export function Aurora() {
  return (
    <>
      <div className="osky-aurora" aria-hidden="true">
        <b className="b1" />
        <b className="b2" />
        <b className="b3" />
        <b className="b4" />
      </div>
      <div className="osky-grain" aria-hidden="true" />
    </>
  );
}
