interface FileHandleLike {
  kind: 'file';
  getFile(): Promise<File>;
}
interface DirHandleLike {
  kind: 'directory';
  values(): AsyncIterable<FileHandleLike | DirHandleLike>;
}

const IMAGE_NAME = /\.(jpe?g|heic|heif|png|webp|tiff?)$/i;

export const isImageFile = (f: File) => f.type.startsWith('image/') || IMAGE_NAME.test(f.name);

export function canPickFolder(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

async function walk(dir: DirHandleLike, out: File[]): Promise<void> {
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') await walk(entry, out);
    else {
      const file = await entry.getFile();
      if (isImageFile(file)) out.push(file);
    }
  }
}

/** Chromium only: pick a folder and collect every image inside it. Returns [] if cancelled. */
export async function pickFolderImages(): Promise<File[]> {
  const picker = (
    window as unknown as { showDirectoryPicker?: () => Promise<DirHandleLike> }
  ).showDirectoryPicker;
  if (!picker) return [];
  try {
    const dir = await picker.call(window);
    const out: File[] = [];
    await walk(dir, out);
    return out;
  } catch {
    return []; // user dismissed the picker
  }
}
