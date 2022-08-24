
# Wikidart

Wikipedia link path finder made with Deno

# Table of contents

1. [Installation](#Installation)
2. [Configuration](#Configuration)
3. [Running](#Running)
4. [Notes](#Notes)

## Installation

```bash
git clone https://github.com/kanagrou/Wikidart
```

## Configuration
The configuration happens in the file `.config`
The first two lines shall start with these commands:

*./.config*
```
Start at x
End at y
```
Where *x* is the root and *y* is the destination.

The following lines dictate runtime options. For example:

*./.config*
```
maxDepth is 5
```
There is **1** option available:
- *maxDepth*: Max link depth

## Running

```bash
cd Wikidart
deno run --allow-net --allow-read main.ts
```

## Notes

This project is not optimized so finding paths with a depth too high will take a very long time.
