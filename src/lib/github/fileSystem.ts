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
        // In Reader Mode, we fetch from the static deployment
        // Assuming path is relative to root, e.g. "course.yaml" or "content/intro.mdx"
        // We might need to handle leading slashes
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        try {
            const response = await fetch(normalizedPath);
            if (!response.ok) {
                // If 404, throw specific error for content loader to handle
                if (response.status === 404) {
                    throw new Error(`File not found: ${path}`);
                }
                throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
            }
            return await response.text();
        } catch (e: any) {
            console.error(`[BrowserFS] Read Error ${path}`, e);
            throw e;
        }
    }

    async writeFile(path: string, content: string): Promise<void> {
        console.log(`[BrowserFS] Write ${path}`, content);
    }

    async createDirectory(path: string): Promise<void> {
        console.log(`[BrowserFS] Mkdir ${path}`);
    }

    async listDir(path: string): Promise<string[]> {
        return [];
    }

    async exists(path: string): Promise<boolean> {
        return false;
    }

    async uploadImage(path: string, file: File): Promise<string> {
        console.log(`[BrowserFS] Upload ${path}`);
        return URL.createObjectURL(file);
    }
}

import { GitHubService } from "./github";

export class GitHubFileSystem implements IFileSystem {
    private github: GitHubService;
    private owner: string;
    private repo: string;
    private branch: string;

    constructor(
        github: GitHubService,
        owner: string,
        repo: string,
        branch: string
    ) {
        this.github = github;
        this.owner = owner;
        this.repo = repo;
        this.branch = branch;
    }

    async readFile(path: string): Promise<string> {
        return this.github.readFile(this.owner, this.repo, path, this.branch);
    }

    async writeFile(path: string, content: string): Promise<void> {
        return this.github.writeFile(this.owner, this.repo, path, content, `Update ${path}`, this.branch);
    }

    async createDirectory(path: string): Promise<void> {
        // GitHub doesn't have explicit directories, create a .keep file
        return this.github.writeFile(this.owner, this.repo, `${path}/.keep`, '', `Create directory ${path}`, this.branch);
    }

    async listDir(path: string): Promise<string[]> {
        // Not implemented in Service yet properly for filtering, but we can return empty for now
        return [];
    }

    async exists(path: string): Promise<boolean> {
        try {
            await this.readFile(path);
            return true;
        } catch {
            return false;
        }
    }

    async uploadImage(path: string, file: File): Promise<string> {
        return this.github.uploadImage(this.owner, this.repo, path, file, this.branch);
    }
}
