// Two pictures of a map, as shared components (styles in app.css, "two pictures of a map"): the
// Real places cards use them, and any page that shows a map two ways can. Until the Frame pass
// records the design, new interface is built from shared pieces like these (D176).
//
// - InsetPicture: the main picture, with the other as a small inset in its corner that fills the
//   picture on hover, keyboard focus or a click (a tap on a phone); another click puts it back.
// - PicturePair: the two side by side.

import { useState } from "preact/hooks";

export interface Picture {
  src: string;
  alt: string;
}

function Img({ p }: { p: Picture }) {
  return <img src={p.src} width={240} height={240} loading="lazy" decoding="async" alt={p.alt} />;
}

export function InsetPicture({ main, inset, label }: { main: Picture; inset: Picture; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="pictures pictures-inset">
      <Img p={main} />
      <button type="button" class="pictures-toggle" aria-pressed={open} aria-label={label} onClick={() => setOpen(!open)}>
        <Img p={inset} />
      </button>
    </div>
  );
}

export function PicturePair({ first, second }: { first: Picture; second: Picture }) {
  return (
    <div class="pictures pictures-pair">
      <Img p={first} />
      <Img p={second} />
    </div>
  );
}
