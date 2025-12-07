import yaml from 'js-yaml';
import type { IFileSystem } from '../lib/github/fileSystem';

export interface CourseItem {
    title: string;
    path?: string;
    items?: CourseItem[];
}

export interface CourseStructure {
    title: string;
    structure: CourseItem[];
}

export async function loadCourseStructure(fs?: IFileSystem): Promise<CourseStructure> {
    if (fs) {
        try {
            // Try loading from src/content first (standard location)
            if (await fs.exists('src/content/course.yaml')) {
                const content = await fs.readFile('src/content/course.yaml');
                return yaml.load(content) as CourseStructure;
            }
            // Fallback to root (legacy)
            if (await fs.exists('course.yaml')) {
                const content = await fs.readFile('course.yaml');
                return yaml.load(content) as CourseStructure;
            }
            // Fallback to src/content/course.yaml for compatibility?
            // Actually, for new GitHub repos we should enforce root.
            console.warn("course.yaml not found in root, returning empty structure");
            return { title: 'New Course', structure: [] };
        } catch (e) {
            console.error("Failed to load course.yaml from FS", e);
            return { title: 'Error Loading Course', structure: [] };
        }
    }

    // Import yaml as raw string
    const modules = import.meta.glob('../content/course.yaml', { query: '?raw', import: 'default', eager: true });
    const yamlContent = modules['../content/course.yaml'] as string;
    return yaml.load(yamlContent) as CourseStructure;
}

export async function loadBundledFile(path: string): Promise<string | null> {
    // Import all MDX files as raw strings
    const modules = import.meta.glob('../content/**/*.mdx', { query: '?raw', import: 'default', eager: true });

    // Normalize path to match glob keys
    // Glob keys are relative to this file: ../content/path/to/file.mdx

    // Input path might be "a1/lesson-1" or "src/content/a1/lesson-1.mdx" or "/a1/lesson-1"
    let cleanPath = path.startsWith('/') ? path.slice(1) : path;
    if (cleanPath.startsWith('src/content/')) cleanPath = cleanPath.replace('src/content/', '');
    if (cleanPath.endsWith('.mdx')) cleanPath = cleanPath.slice(0, -4);

    const candidates = [
        `../content/${cleanPath}.mdx`,
        `../content/${cleanPath}/index.mdx`
    ];

    for (const key of candidates) {
        if (key in modules) {
            return modules[key] as string;
        }
    }

    return null;
}
