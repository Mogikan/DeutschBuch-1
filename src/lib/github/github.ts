import { Octokit } from "octokit";
// Buffer removed for browser compatibility

export interface GitHubUser {
    login: string;
    avatar_url: string;
    email?: string;
}

export interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    default_branch: string;
    owner: {
        login: string;
        avatar_url?: string;
    };
}

export interface TreeItem {
    path: string;
    mode: '100644' | '100755' | '040000' | '160000' | '120000';
    type: 'blob' | 'tree' | 'commit';
    content?: string;
    sha?: string | null;
}

export class GitHubService {
    private octokit: Octokit | null = null;
    private user: GitHubUser | null = null;

    constructor() { }

    isAuthenticated(): boolean {
        return !!this.octokit;
    }

    async authenticate(token: string): Promise<GitHubUser> {
        this.octokit = new Octokit({ auth: token });
        const { data } = await this.octokit.rest.users.getAuthenticated();
        this.user = {
            login: data.login,
            avatar_url: data.avatar_url,
            email: data.email as string | undefined
        };
        return this.user;
    }

    getUser(): GitHubUser | null {
        return this.user;
    }

    async listRepos(): Promise<GitHubRepo[]> {
        if (!this.octokit) throw new Error("Not authenticated");
        const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
            sort: 'updated',
            direction: 'desc',
            per_page: 100
        });
        return data.map(repo => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            default_branch: repo.default_branch,
            owner: {
                login: repo.owner.login,
                avatar_url: repo.owner.avatar_url
            }
        }));
    }

    async createRepo(name: string, isPrivate: boolean): Promise<GitHubRepo> {
        if (!this.octokit) throw new Error("Not authenticated");
        const { data } = await this.octokit.rest.repos.createForAuthenticatedUser({
            name,
            private: isPrivate,
            auto_init: true // Initialize with README
        });
        return {
            id: data.id,
            name: data.name,
            full_name: data.full_name,
            private: data.private,
            default_branch: data.default_branch
        };
    }

    async readFile(owner: string, repo: string, path: string, branch?: string): Promise<string> {
        if (!this.octokit) throw new Error("Not authenticated");
        console.log(`[GitHub] Reading file: ${path} (branch: ${branch})`);
        try {
            const { data } = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path,
                ref: branch,
                headers: {
                    'If-None-Match': ''
                }
            });

            if (Array.isArray(data) || !('content' in data)) {
                throw new Error("Path is a directory, not a file");
            }

            // content is base64 encoded
            const binaryContent = atob(data.content.replace(/\n/g, ''));
            // Properly decode UTF-8
            const content = decodeURIComponent(escape(binaryContent));
            return content;
        } catch (error: any) {
            console.error(`[GitHub] Read error for ${path}:`, error);
            if (error.status === 404) {
                throw new Error("File not found");
            }
            throw error;
        }
    }

    async writeFile(owner: string, repo: string, path: string, content: string, message: string, branch?: string): Promise<void> {
        if (!this.octokit) throw new Error("Not authenticated");
        console.log(`[GitHub] Writing file: ${path} (branch: ${branch})`);

        let sha: string | undefined;
        try {
            const { data } = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path,
                ref: branch,
                headers: {
                    'If-None-Match': ''
                }
            });
            if (!Array.isArray(data) && 'sha' in data) {
                sha = data.sha;
                console.log(`[GitHub] Found existing SHA for ${path}: ${sha}`);
            }
        } catch (e: any) {
            // File doesn't exist, that's fine
            if (e.status !== 404) throw e;
        }

        await this.octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message,
            content: btoa(unescape(encodeURIComponent(content))), // Unicode safe base64
            sha,
            branch
        });
    }

    async uploadImage(owner: string, repo: string, path: string, file: File, branch?: string): Promise<string> {
        if (!this.octokit) throw new Error("Not authenticated");

        const buffer = await file.arrayBuffer();
        // Convert ArrayBuffer to Base64
        const binary = Array.from(new Uint8Array(buffer));
        const base64Content = btoa(binary.map(b => String.fromCharCode(b)).join(''));

        await this.octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message: `Upload image: ${path}`,
            content: base64Content,
            branch
        });

        // Return raw URL or GitHub blob URL? Raw is better for rendering if public
        // Or better: `https://raw.githubusercontent.com/${owner}/${repo}/${branch || 'main'}/${path}`
        // But for private repos, we need to use the token to fetch it, so raw URL won't work in <img src> directly without auth proxy.
        // For MVP, if public, raw url works. If private, we might need a Blob URL in memory.

        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch || 'main'}/${path}`;
    }

    async commitMulti(owner: string, repo: string, treeItems: TreeItem[], message: string, branch: string = 'main'): Promise<void> {
        if (!this.octokit) throw new Error("Not authenticated");

        // 1. Get current commit SHA
        const ref = `heads/${branch}`;
        const { data: refData } = await this.octokit.rest.git.getRef({ owner, repo, ref });
        const latestCommitSha = refData.object.sha;

        // 2. Get base tree SHA
        const { data: commitData } = await this.octokit.rest.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
        const baseTreeSha = commitData.tree.sha;

        // 3. Create new tree
        const { data: treeData } = await this.octokit.rest.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: treeItems
        });

        // 4. Create commit
        const { data: newCommitData } = await this.octokit.rest.git.createCommit({
            owner,
            repo,
            message,
            tree: treeData.sha,
            parents: [latestCommitSha]
        });

        // 5. Update Ref
        await this.octokit.rest.git.updateRef({
            owner,
            repo,
            ref,
            sha: newCommitData.sha
        });
    }
}
