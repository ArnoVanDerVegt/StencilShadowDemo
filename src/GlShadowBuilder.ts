interface IGlShadowBuilder {
    _renderer:            IGlRenderer;
    _lineSides:           IAnyList;
    _item:                any;
    _glPositionBuffer:    IGlBuffer;
    _glVertexIndexBuffer: IGlBuffer;
    _glVertices:          INumberList;
    _glIndices:           INumberList;
    _lightLocation:       INumberList;
    setupData(): void;
    addGLVertex(vector: INumberList): void;
    addShadowSide(vector1: INumberList, vector2: INumberList, vector3: INumberList, vector4: INumberList): void;
    checkDirection(lightLocation: INumberList): void;
    findEdge(): void;
    rotateVectorX(vector: INumberList, angle: number): void;
    rotateVectorY(vector: INumberList, angle: number): void;
    rotateVectorZ(vector: INumberList, angle: number): void;
    update(lightLocation: INumberList, lightAngle: number, matrix: any, zoom: number): void;
    createVolume(lightLocation: INumberList): void;
    render(): void;
}

class GlShadowBuilder implements IGlShadowBuilder {
    _renderer:            IGlRenderer;
    _lineSides:           IAnyList;
    _item:                any;
    _glPositionBuffer:    IGlBuffer;
    _glVertexIndexBuffer: IGlBuffer;
    _glVertices:          INumberList;
    _glIndices:           INumberList;
    _lightLocation:       INumberList;

    constructor(opts: any) {
        this._renderer            = opts.renderer;
        this._item                = opts.item;
        this._lineSides           = [];
        this._glPositionBuffer    = null;
        this._glVertexIndexBuffer = null;
    }

    setupData(): void {
        let gl: IGl = this._renderer.getGl();
        if (this._glPositionBuffer !== null) {
            gl.deleteBuffer(this._glPositionBuffer);
        }
        if (this._glVertexIndexBuffer !== null) {
            gl.deleteBuffer(this._glVertexIndexBuffer);
        }
        this._glVertices = [];
        this._glIndices  = [];
    };

    addGLVertex(vector: INumberList): void {
        this._glVertices.push(vector[0], vector[1], vector[2]);
        this._glIndices.push(this._glIndices.length);
    };

    addShadowSide(vector1: INumberList, vector2: INumberList, vector3: INumberList, vector4: INumberList): void {
        this.addGLVertex(vector1);
        this.addGLVertex(vector2);
        this.addGLVertex(vector3);

        this.addGLVertex(vector4);
        this.addGLVertex(vector3);
        this.addGLVertex(vector2);
    };

    /**
     * Check which triangles face the light source...
    **/
    checkDirection(lightLocation: INumberList): void {
        let triangles = this._item.getTriangles();
        let triangle;
        let vector;
        let i = triangles.length;
        while (i) {
            i--;
            // Create a normalized vector based on the vector from
            // the center of the triangle to the lights position...
            triangle         = triangles[i];
            vector           = vec3.fromValues(triangle.center[0], triangle.center[1], triangle.center[2]);
            vec3.subtract(vector, vector, lightLocation)
            vec3.normalize(vector, vector);
            // Compare the vector with the normal of the triangle...
            triangle.visible = (vec3.dot(vector, triangle.normal) < 0);
        }
    }

    /**
     * Find the edge of the object...
    **/
    findEdge(): void {
        let triangles     = this._item.getTriangles();
        let triangle;
        let a, b;
        let lines         = this._item.getLines();
        let line;
        let lineSidesHash = {};
        let i, j, k;
        this._lineSides.length = 0;
        i = triangles.length;
        while (i) {
            i--;
            triangle = triangles[i];
            if (triangle.visible) {
                j = 3;
                while (j) {
                    j--;
                    // Check if the side...
                    k    = triangle.lines[j];
                    line = lines[k];
                    a    = line.v1 + '_' + line.v2;
                    b    = line.v2 + '_' + line.v1;
                    if (lineSidesHash[a] !== undefined) { // Check the v1 -> v2 direction...
                        // The side already exists, remove it...
                        delete(lineSidesHash[a]);
                    } else if (lineSidesHash[b] !== undefined) { // Check the v2 -> v1 direction...
                        // The side already exists, remove it...
                        delete(lineSidesHash[b]);
                    } else {
                        // It's a new side, add it to the list...
                        lineSidesHash[a] = k;
                    }
                }
            }
        }

        // Convert the hash map to an array...
        for (i in lineSidesHash) {
            line = lines[lineSidesHash[i]];
            this._lineSides.push(line);
        }
    }

    rotateVectorX(vector: INumberList, angle: number): void {
        if (angle === 0) {
            return;
        }
        let y   = vector[1];
        let z   = vector[2];
        let sin = Math.sin(angle);
        let cos = Math.cos(angle);
        vector[1] = y * cos - z * sin;
        vector[2] = y * sin + z * cos;
    };

    rotateVectorY(vector: INumberList, angle: number): void {
        if (angle === 0) {
            return;
        }
        let x   = vector[0];
        let z   = vector[2];
        let sin = Math.sin(angle);
        let cos = Math.cos(angle);
        vector[0] = z * sin + x * cos;
        vector[2] = z * cos - x * sin;
    };

    rotateVectorZ(vector: INumberList, angle: number): void {
        if (angle === 0) {
            return;
        }
        let x   = vector[0];
        let y   = vector[1];
        let sin = Math.sin(angle);
        let cos = Math.cos(angle);
        vector[0] = x * cos - y * sin;
        vector[1] = x * sin + y * cos;
    }

    /**
     * Update the shadow...
    **/
    update(lightLocation: INumberList, lightAngle: number, matrix: any, zoom: number): void {
        // Get the position of the light from the matrix, remove the zoom value...
        let sin, cos, x, y, z;
        let vector1 = vec3.fromValues(lightLocation[0], lightLocation[1], lightLocation[2]);
        let vector2 = vec3.fromValues(matrix[12], matrix[13], matrix[14] + zoom);
        let vector = vec3.create();
        vec3.subtract(vector, vector1, vector2);
        // Instead of rotating the object to face the light at the
        // right angle it's a lot faster to rotate the light in the
        // reverse direction...
        this.rotateVectorX(vector, -lightAngle[0]);
        this.rotateVectorY(vector, -lightAngle[1]);
        this.rotateVectorZ(vector, -lightAngle[2]);
        // Store the location for later use...
        this._lightLocation = vector;
        this.setupData();              // Reset all lists and buffers...
        this.checkDirection(vector);   // Check which triangles face the light source...
        this.findEdge();               // Find the edge...
    }

    /**
     * Create the buffers for the shadow volume...
    **/
    createVolume(lightLocation: INumberList): void {
        let gl         = this._renderer.getGl();
        let vertices   = this._item.getVertices();
        let triangles  = this._item.getTriangles();
        let triangle;
        let lineSides  = this._lineSides;
        let vector3    = vec3.create();
        let vector4    = vec3.create();
        let i          = lineSides.length;
        let j;
        while (i) { // For all edge lines...
            i--;
            let line    = lineSides[i];
            let vector1 = vertices[line.v1];
            let vector2 = vertices[line.v2];
            // Extrude the line away from the light...
            // Get the vector from the light position to the vertex...
            vec3.subtract(vector3, vector1, lightLocation);
            // Add the normalized vector scaled with the volume
            // depth to the vertex which gives a point on the other
            // side of the object than the light source...
            vec3.normalize(vector3, vector3);
            vec3.scale(vector3, vector3, 30);
            vec3.add(vector3, vector3, vector1);
            // And again for the second point on the line...
            vec3.subtract(vector4, vector2, lightLocation);
            vec3.normalize(vector4, vector4);
            vec3.scale(vector4, vector4, 30);
            vec3.add(vector4, vector4, vector2);
            this.addShadowSide(vector1, vector2, vector3, vector4);
        }
        // Add the end caps to the volume...
        let vector2 = vec3.create();
        i = triangles.length;
        while (i) {
            i--;
            triangle = triangles[i];
            if (triangle.visible) { // Only add polygons facing the light...
                // Add the top...
                j = 3;
                while (j) {
                    j--;
                    this.addGLVertex(vertices[triangle.vertices[j]]);
                }
                // Add the bottom...
                j = 0;
                while (j < 3) {
                    let vector1 = vertices[triangle.vertices[j]];
                    vec3.subtract(vector2, vector1, lightLocation);
                    vec3.normalize(vector2, vector2);
                    vec3.scale(vector2, vector2, 30);
                    vec3.add(vector2, vector2, vector1);
                    this.addGLVertex(vector2);
                    j++;
                }
            }
        }
        // Create the vertex position buffer...
        this._glPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._glPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._glVertices), gl.STATIC_DRAW);
        this._glPositionBuffer.itemSize = 3;
        // Create the vertex index buffer...
        this._glVertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._glVertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this._glIndices), gl.STATIC_DRAW);
        this._glVertexIndexBuffer.numItems = this._glIndices.length;
    }

    render(): void {
        let gl:            IGl              = this._renderer.getGl();
        let shaderProgram: IGlShaderProgram = this._renderer.getShaderProgram();
        // Create the volume for the light...
        this.createVolume(this._lightLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._glPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this._glPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._glVertexIndexBuffer);
        this._renderer.setMatrixUniforms();
        // Disable the texture coord attribute...
        gl.disableVertexAttribArray(shaderProgram.textureCoordAttribute);
        // Disable the normal attribute...
        gl.disableVertexAttribArray(shaderProgram.vertexNormalAttribute);
        // Disable the color attribute...
        gl.disableVertexAttribArray(shaderProgram.vertexColorAttribute);

        // Render both front and back facing polygons with different stencil operations...
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.STENCIL_TEST);
        gl.depthFunc(gl.LESS);

        // Disable rendering to the color buffer...
        gl.colorMask(false, false, false, false);
        // Disable z buffer updating...
        gl.depthMask(false);
        // Allow all bits in the stencil buffer...
        gl.stencilMask(255);

        // Increase the stencil buffer for back facing polygons, set the z pass opperator
        gl.stencilOpSeparate(gl.BACK,  gl.KEEP, gl.KEEP, gl.INCR);
        // Decrease the stencil buffer for front facing polygons, set the z pass opperator
        gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR);

        // Always pass...
        gl.stencilFunc(gl.ALWAYS, 0, 255);
        gl.drawElements(gl.TRIANGLES, this._glVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

        // Enable rendering the the color and depth buffer again...
        gl.colorMask(true, true, true, true);
        gl.depthMask(true);

        gl.disable(gl.STENCIL_TEST);
    }
}