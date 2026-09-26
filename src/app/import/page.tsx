import type { Metadata } from "next";

import { ModuleIcon } from "@/components/icons/ModuleIcon";
import { AudioImport } from "@/components/import/AudioImport";

export const metadata: Metadata = { title: "Import audio · EVAWAVE" };

/** Audio import to a StyleProfile (docs/SPEC.md §1.7): analysis runs on this device. */
export default function ImportPage() {
  return (
    <main id="main" className="page">
      <div className="page-head">
        <h2>
          <ModuleIcon name="intake" className="page-icon" /> Import audio
        </h2>
      </div>
      <p>
        Drop in a reference track. EVAWAVE measures its tempo, meter, key, loudness, energy and spectrum on this device and proposes a style profile for you to
        review. The audio never leaves the device: only the measurements, and the profile you accept, are saved.
      </p>
      <AudioImport />
    </main>
  );
}
