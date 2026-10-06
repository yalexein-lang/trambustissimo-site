// Match the preserved native chromaticNoteTuning13 owner, including C5 slot 12.
export function tuningIndexForMidi(note,root=60){const relative=Math.round(Number(note))-root;return relative>=0&&relative<=12?relative:((relative%12)+12)%12}
