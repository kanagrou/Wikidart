import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";


interface GameOptions {
    maxDepth?: number
}


class Logger {
    public nl() {
        console.log();
    }
    public lb(length: number) {
        console.log('-'.repeat(length));
    }
    public row(...entries: (string | number)[]) {
        console.log(entries.map((e, i, arr) => i == arr.length - 1 ? `${e}` : `${e}\t`).reduce((p, c) => p + c));
    }
    public title(...entries: (string | number)[]) {
        console.log(entries.map((e) => `${e}`).reduce((p, c) => p + c).toUpperCase());
    }
}

class Config {
    path: string
    options?: GameOptions
    start?: string
    end?: string

    constructor(path: string) {
        this.path = path;
    }

    public async load() {
        const content = await Deno.readTextFile('.config');
        const {start, end, options} = this.parse(content);
        this.start = start;
        this.end = end;
        this.options = options;
        return this;
    }
    private parse(content: string): {start:string, end:string, options:GameOptions} {

        const startMatch = content.match(/(?<=start at ).*/i)
        if (!startMatch) throw new Error('Did not specify starting position in Config File.');
        const start = startMatch[0];
        const endMatch = content.match(/(?<=end at ).*/i)
        if (!endMatch) throw new Error('Did not specify end position in Config File.');
        const end = endMatch[0];
        
        const optionMatches = content.matchAll(/^\w+ is \d+$/gmi)

        const options: GameOptions = {maxDepth: 3}
        for (const match of optionMatches) {
            const option = match[0].split(' ');
            options[option[0] as keyof GameOptions] = parseInt(option[2])
        }
        return {start, end, options}
    }
}

class Wikipage {
    
    url: URL;
    content?: string;
    parser: DOMParser;
    
    constructor(path: string) {
        this.url = new URL('https://en.wikipedia.org/wiki/' + path);
        this.parser = new DOMParser()
    }

    public async fetch() {
        const response = await fetch(this.url);
        this.content = await response.text();
        return this;
    }

    get links() {
        if (!this.content) throw new Error('Did not fetch page.');
        const document = this.parser.parseFromString(this.content, 'text/html');
        if (!document) throw new Error('Error when parsing page.');
        const paragraphs = document.getElementsByTagName('p');
        let links: string[] = [];
        paragraphs.forEach(par => {links = [...links, ...par.getElementsByTagName('a').map(elem => elem.getAttribute('href')).filter(link => link && link.startsWith('/wiki/')).map(link => link?.slice(6)) as string[]]})
        return links;
    }
}

interface Node {
    value: string
    depth: number
    children?: Node[]
    parent?: Node
}

class Tree {
    root: Node

    constructor(rootValue: string) {
        this.root = {
            value: rootValue,
            depth: 0
        };
    }

    public search(value: string, root?: Node): Node | null {
        root = root || this.root;
        if (root.value == value) return root;
        if (!root.children || root.children.length < 1) return null;
        for (const child of root.children) {
            const searchResult = this.search(value, child)
            if (searchResult) return searchResult;
        }
        return null;
    }

    public reduce(level: Node[] = [this.root], stack = [[this.root]], depth = 1): Node[][] {
        const children = level.reduce((acc, node) => acc.concat(node.children || []), [] as Node[]);
        if (!children.length) return stack;
        stack[depth] = children;
        return this.reduce(children, stack, depth + 1);
    }

    public depth(depth: number): Node[] | null {
        return this.reduce()[depth-1];
    }
}

export class Wikidart {

    start: string;
    end: string;
    options: GameOptions;
    tree: Tree;
    logger: Logger;
    deltaTime?: number;

    constructor({start, end, ...options}: {start: string, end: string} & GameOptions) {
        this.start = start;
        this.end = end
        this.options = options;
        this.tree = new Tree(this.start);
        this.logger = new Logger();
        const title = 'Welcome to Wikidart!'
        logger.nl();
        logger.title(title)
        logger.row('START', 'END');
        logger.row(start, end);
        if (options) {
            logger.lb(title.length);
            logger.title('Options');
            logger.row(...Object.keys(options));
            logger.row(...Object.values(options));
        }
        logger.lb(title.length);
    }

    public async play() {
        const startTime = Date.now();
        for (let currentDepth = 1; currentDepth<=(this.options.maxDepth || 3); currentDepth++) {
            const depthNodes = this.tree.depth(currentDepth);
            if (!depthNodes) return null;
            const title = `Starting search at depth ${currentDepth}`;
            this.logger.nl();
            this.logger.title(title);
            this.logger.lb(title.length)
            this.logger.row('DEPTH', 'LINK');
            for (const node of depthNodes) {
                this.logger.row(currentDepth, node.value);
                const endNode = await this.branch(node, currentDepth);
                this.deltaTime = Date.now() - startTime;
                if (endNode) return endNode
            }
        }
        this.deltaTime = Date.now() - startTime;
        return null;
    }

    private async branch(root: Node, maxDepth: number): Promise<Node | null> {
        // console.log(root.value)
        if (root.value == this.end) return root;
        if (this.options.maxDepth && (root.depth >= maxDepth)) return null;
        const page = new Wikipage(root.value);
        await page.fetch();
        root.children = page.links.map(link => {
            return {
                parent: root,
                depth: root.depth + 1,
                value: link
            } as Node
        }).filter(node => !this.tree.search(node.value));
        for (const child of root.children) {
            const branchResult = await this.branch(child, maxDepth);
            if (branchResult) return branchResult;
        }
        return null
    }
}



const config = new Config('.config');
const logger = new Logger();

config.load().then(conf => {
    const start = conf.start!;
    const end = conf.end!;
    const options = conf.options;
    const game = new Wikidart({start, end, ...options});
    game.play().then(node => {
        if (node) {
            const title = 'Search Successful';
            logger.nl();
            logger.lb(title.length);
            logger.title(title);
            logger.row('RUNTIME');
            logger.row((game.deltaTime! / 1000).toFixed(2)+'s');
            logger.lb(title.length);
            logger.nl();
            logger.title('Found Path');
            logger.row('DEPTH', 'LINK');
            const stack: Node[] = [node];
            let currentNode = node
            while (currentNode.parent) {
                stack.push(currentNode.parent)
                currentNode = currentNode.parent;
            }
            for (const n of stack.reverse()) {
                logger.row(n.depth, n.value);
            }
            logger.lb(title.length);

        } else {
            const title = 'Search Unsuccessful';
            logger.lb(title.length);
            logger.title(title);
            logger.row('RUNTIME');
            logger.row((game.deltaTime! / 1000).toFixed(2)+'s');
            logger.lb(title.length);
        }
    });
});