// Level Editor
class LevelEditor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = 30; // Size of each grid cell
        this.mapSize = 20; // 20x20 grid
        this.blocks = new Set(); // Set of block positions as strings "x,y"
        this.isPlacing = false;
        
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / this.gridSize);
            const y = Math.floor((e.clientY - rect.top) / this.gridSize);
            
            if (x >= 0 && x < this.mapSize && y >= 0 && y < this.mapSize) {
                const key = `${x},${y}`;
                if (this.blocks.has(key)) {
                    this.blocks.delete(key);
                } else {
                    this.blocks.add(key);
                }
                this.render();
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / this.gridSize);
            const y = Math.floor((e.clientY - rect.top) / this.gridSize);
            
            if (x >= 0 && x < this.mapSize && y >= 0 && y < this.mapSize) {
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'default';
            }
        });
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= this.mapSize; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.gridSize, 0);
            this.ctx.lineTo(i * this.gridSize, this.canvas.height);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.gridSize);
            this.ctx.lineTo(this.canvas.width, i * this.gridSize);
            this.ctx.stroke();
        }

        // Draw blocks
        this.ctx.fillStyle = '#4ecdc4';
        this.blocks.forEach(blockKey => {
            const [x, y] = blockKey.split(',').map(Number);
            this.ctx.fillRect(x * this.gridSize, y * this.gridSize, this.gridSize, this.gridSize);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.strokeRect(x * this.gridSize, y * this.gridSize, this.gridSize, this.gridSize);
        });
    }

    getLevelData() {
        // Convert blocks set to array of {x, y} objects
        return Array.from(this.blocks).map(blockKey => {
            const [x, y] = blockKey.split(',').map(Number);
            return { x, y };
        });
    }

    loadLevelData(blocks) {
        this.blocks.clear();
        blocks.forEach(block => {
            this.blocks.add(`${block.x},${block.y}`);
        });
        this.render();
    }

    clear() {
        this.blocks.clear();
        this.render();
    }
}

