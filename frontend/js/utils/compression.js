/**
 * ESTIF HOME ULTIMATE - COMPRESSION UTILITIES
 * Data compression and decompression using LZ-string and Gzip
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// COMPRESSION CONFIGURATION
// ============================================

const CompressionConfig = {
    minSizeForCompression: 100, // bytes
    compressionLevel: 6,
    debug: false
};

// ============================================
// COMPRESSION MANAGER
// ============================================

class CompressionManager {
    // ============================================
    // LZ-STRING COMPRESSION (Pure JS)
    // ============================================

    static lzCompress(data) {
        if (typeof data === 'object') {
            data = JSON.stringify(data);
        }
        
        if (data.length < CompressionConfig.minSizeForCompression) {
            return data;
        }
        
        // Simple LZ compression implementation
        let compressed = '';
        let dict = {};
        let dictSize = 256;
        let current = '';
        
        for (let i = 0; i < data.length; i++) {
            const char = data[i];
            const currentChar = current + char;
            if (dict[currentChar] !== undefined) {
                current = currentChar;
            } else {
                compressed += String.fromCharCode(dict[current]);
                dict[currentChar] = dictSize++;
                current = char;
            }
        }
        
        if (current !== '') {
            compressed += String.fromCharCode(dict[current]);
        }
        
        CompressionConfig.debug && console.log(`[Compression] LZ compressed: ${data.length} -> ${compressed.length} (${Math.round((1 - compressed.length / data.length) * 100)}% saved)`);
        return compressed;
    }

    static lzDecompress(compressed) {
        if (typeof compressed !== 'string' || compressed.length === 0) {
            return compressed;
        }
        
        let dict = {};
        let dictSize = 256;
        let current = String.fromCharCode(compressed[0].charCodeAt(0));
        let result = current;
        let entry;
        
        for (let i = 0; i < 256; i++) {
            dict[i] = String.fromCharCode(i);
        }
        
        for (let i = 1; i < compressed.length; i++) {
            const code = compressed[i].charCodeAt(0);
            if (dict[code] !== undefined) {
                entry = dict[code];
            } else if (code === dictSize) {
                entry = current + current[0];
            } else {
                throw new Error('Invalid compressed data');
            }
            
            result += entry;
            dict[dictSize++] = current + entry[0];
            current = entry;
        }
        
        // Try to parse as JSON if it was originally JSON
        try {
            return JSON.parse(result);
        } catch {
            return result;
        }
    }

    // ============================================
    // BASE64 COMPRESSION
    // ============================================

    static toBase64(str) {
        if (typeof str !== 'string') {
            str = JSON.stringify(str);
        }
        return btoa(encodeURIComponent(str));
    }

    static fromBase64(base64) {
        const str = decodeURIComponent(atob(base64));
        try {
            return JSON.parse(str);
        } catch {
            return str;
        }
    }

    // ============================================
    // URI COMPONENT ENCODING
    // ============================================

    static encodeURI(data) {
        if (typeof data === 'object') {
            data = JSON.stringify(data);
        }
        return encodeURIComponent(data);
    }

    static decodeURI(encoded) {
        const str = decodeURIComponent(encoded);
        try {
            return JSON.parse(str);
        } catch {
            return str;
        }
    }

    // ============================================
    // ARRAYBUFFER COMPRESSION
    // ============================================

    static async gzip(data) {
        if (typeof Blob === 'undefined') return data;
        
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        const blob = new Blob([str], { type: 'application/json' });
        const stream = blob.stream();
        
        // Use CompressionStream if available
        if (typeof CompressionStream !== 'undefined') {
            const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
            const compressedBlob = await new Response(compressedStream).blob();
            return await compressedBlob.arrayBuffer();
        }
        
        return str;
    }

    static async gunzip(arrayBuffer) {
        if (typeof DecompressionStream !== 'undefined') {
            const blob = new Blob([arrayBuffer]);
            const stream = blob.stream();
            const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
            const decompressedBlob = await new Response(decompressedStream).blob();
            const text = await decompressedBlob.text();
            try {
                return JSON.parse(text);
            } catch {
                return text;
            }
        }
        return arrayBuffer;
    }

    // ============================================
    // SMART COMPRESSION
    // ============================================

    static compress(data, method = 'auto') {
        if (data === null || data === undefined) return data;
        
        if (method === 'auto') {
            const jsonStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
            if (jsonStr.length < CompressionConfig.minSizeForCompression) {
                return data;
            }
            method = 'lz';
        }
        
        switch (method) {
            case 'lz':
                return this.lzCompress(data);
            case 'base64':
                return this.toBase64(data);
            case 'uri':
                return this.encodeURI(data);
            default:
                return data;
        }
    }

    static decompress(data, method = 'auto') {
        if (data === null || data === undefined) return data;
        
        if (method === 'auto') {
            if (typeof data === 'string' && data.length > 0) {
                if (data.includes('%')) method = 'uri';
                else if (data.match(/^[A-Za-z0-9+/=]+$/)) method = 'base64';
                else method = 'lz';
            } else {
                return data;
            }
        }
        
        switch (method) {
            case 'lz':
                return this.lzDecompress(data);
            case 'base64':
                return this.fromBase64(data);
            case 'uri':
                return this.decodeURI(data);
            default:
                return data;
        }
    }
}

// ============================================
// EXPORTS
// ============================================

// Expose globally
window.CompressionManager = CompressionManager;
window.CompressionConfig = CompressionConfig;

export { CompressionManager, CompressionConfig };