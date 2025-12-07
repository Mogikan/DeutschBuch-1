
export interface IFileSystem {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    createDirectory(path: string): Promise<void>;
    listDir(path: string): Promise<string[]>;
    exists(path: string): Promise<boolean>;
    uploadImage(path: string, file: File): Promise<string>;
}

export class BrowserFileSystem implements IFileSystem {
    async readFile(path: string): Promise<string> {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        try {
            const response = await fetch(normalizedPath);
            if (!response.ok) {
                if (response.status === 404) throw new Error(`File not found: ${path}`);
                throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
            }
            return await response.text();
        } catch (e: any) {
            console.error(`[BrowserFS] Read Error ${path}`, e);
            throw e;
        }
    }

    async writeFile(_path: string, content: string): Promise<void> { console.log(`[BrowserFS] Write ${_path}`, content); }
    async createDirectory(_path: string): Promise<void> { console.log(`[BrowserFS] Mkdir ${_path}`); }
    async listDir(_path: string): Promise<string[]> { return []; }
    async exists(_path: string): Promise<boolean> { return false; }
    async uploadImage(path: string, file: File): Promise<string> {
        console.log(`[BrowserFS] Upload ${path}`);
        return URL.createObjectURL(file);
    }
}
export { BrowserFileSystem as GitHubFileSystem }; // Alias for compatibility if needed
