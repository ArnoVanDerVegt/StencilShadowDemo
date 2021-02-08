declare var vec3: any;

interface IRenderer {
    getGl():             IGl;
    getShaderProgram():  IGlShaderProgram;
    setMatrixUniforms(): void;
}

interface IGlObject {
    _vertices:             INumberList;     // List of unique vertices of the object
    _verticesHash:         INumberHashMap;  // Hash list of vertices
    _lines:                INumberList;     // List of lines in both directions...
    _linesUnique:          INumberList;     // A list of unique lines
    _triangles:            INumberList;     // Triangles in the object
    _renderer:             IRenderer;
    _texture:              unknown;
    _glVertexCount:        number;          // The active vertex index
    _glVertices:           INumberList;     // Vertex position list for gl
    _glNormals:            INumberList;     // Normal list for gl
    _glIndices:            INumberList;     // Index list for gl
    _glTextureCoords:      INumberList;     // Texture cooordinate list for gl
    _glPositionBuffer:     IGlBuffer;       // Position buffer for gl
    _glNormalBuffer:       IGlBuffer;       // Normal buffer for gl
    _glTextureCoordBuffer: IGlBuffer;       // Texture cooordinate buffer for gl
    _glVertexIndexBuffer:  IGlBuffer;       // Vertex buffer for gl

    addVertex(x: number, y: number, z: number): number;
    addGLVertex(x: number, y: number, z: number, u: number, v: number): number;
    addNormal(normal: unknown): IGlObject;
    addLine(v1: number, v2: number): number;
    addTriangle(x1: number, y1: number, z1: number, uu1: number, vv1: number,
                x2: number, y2: number, z2: number, uu2: number, vv2: number,
                x3: number, y3: number, z3: number, uu3: number, vv3: number): IGlObject;
    createBuffers(): void;
    getVertices(): INumberList;
    getLines(): INumberList;
    getTriangles(): INumberList;
}

interface IGlObjectOpts {
    renderer: IRenderer;
    texture:  unknown;
}

class GlObject implements IGlObject {
    _vertices:             INumberList;     // List of unique vertices of the object
    _verticesHash:         INumberHashMap;  // Hash list of vertices
    _lines:                INumberList;     // List of lines in both directions...
    _linesUnique:          INumberList;     // A list of unique lines
    _triangles:            INumberList;     // Triangles in the object
    _renderer:             IRenderer;
    _texture:              unknown;
    _glVertexCount:        number;          // The active vertex index
    _glVertices:           INumberList;     // Vertex position list for gl
    _glNormals:            INumberList;     // Normal list for gl
    _glIndices:            INumberList;     // Index list for gl
    _glTextureCoords:      INumberList;     // Texture cooordinate list for gl
    _glPositionBuffer:     IGlBuffer;       // Position buffer for gl
    _glNormalBuffer:       IGlBuffer;       // Normal buffer for gl
    _glTextureCoordBuffer: IGlBuffer;       // Texture cooordinate buffer for gl
    _glVertexIndexBuffer:  IGlBuffer;       // Vertex buffer for gl

    constructor(opts: IGlObjectOpts) {
        this._vertices             =  [];
        this._verticesHash         =  {};
        this._lines                =  [];
        this._linesUnique          =  [];
        this._triangles            =  [];
        this._renderer             =  opts.renderer;
        this._texture              =  opts.texture;
        this._glVertexCount        = -1;
        this._glVertices           =  [];
        this._glNormals            =  [];
        this._glIndices            =  [];
        this._glTextureCoords      =  [];
        this._glPositionBuffer     =  null;
        this._glNormalBuffer       =  null;
        this._glTextureCoordBuffer =  null;
        this._glVertexIndexBuffer  =  null;
    }

    /**
     * Add a vertex, merge close vertices...
     * Returns the vertex index
    **/
    addVertex(x: number, y: number, z: number): number {
        let hash:  string = ~~(x * 1000) + '_' + ~~(y * 1000) + '_' + ~~(z * 1000);
        let index: number = this._verticesHash[hash]; // Check if the value was added before...
        if (index === undefined) { // A new vertex...
            index                    = this._vertices.length;
            this._verticesHash[hash] = index;
            this._vertices.push([x, y, z]);
        }
        return index;
    }

    /**
     * Add position and texture cooordinates to the gl lists...
     * Returns the index of the vertex
    **/
    addGLVertex(x: number, y: number, z: number, u: number, v: number): number {
        this._glVertices.push(x, y, z);
        this._glTextureCoords.push(u, v);
        this._glVertexCount++;
        return this._glVertexCount;
    }

    /**
     * Add a normal to a gl list...
    **/
    addNormal(normal: unknown): IGlObject {
        this._glNormals.push(normal[0], normal[1], normal[2]);
        return this;
    }

    /**
     * Add a line.
     * Check if the line is also used by an other polygon.
     & Returns the index of the line.
    **/
    addLine(v1: number, v2: number): number {
        this._lines.push({v1:v1, v2:v2});
        return this._lines.length - 1;
    }

    /**
     * Add a triangle to this object...
     *
     * This method adds the vertex information to
     * the buffers needed the build the shadow.
    **/
    addTriangle(x1: number, y1: number, z1: number, uu1: number, vv1: number,
                x2: number, y2: number, z2: number, uu2: number, vv2: number,
                x3: number, y3: number, z3: number, uu3: number, vv3: number): IGlObject {
        let triangleCount: number = this._triangles.length; // The index of the new triangle...

        // Add the vertices...
        let vertex1: number = this.addVertex(x1, y1, z1);
        let vertex2: number = this.addVertex(x2, y2, z2);
        let vertex3: number = this.addVertex(x3, y3, z3);

        // Add the lines, these are used to calculate the edge of the object...
        // Each line is associated with the new triangle...
        let line1: number = this.addLine(vertex1, vertex2);
        let line2: number = this.addLine(vertex2, vertex3);
        let line3: number = this.addLine(vertex3, vertex1);

        // Calculate the normal of the triangle...
        let vector1: unknown = vec3.fromValues(x2 - x1, y2 - y1, z2 - z1);
        let vector2: unknown = vec3.fromValues(x3 - x2, y3 - y2, z3 - z2);
        let vector3: unknown = vec3.create();

        vec3.cross(vector3, vector1, vector2)
        vec3.normalize(vector3, vector3);

        // Add normals for 3 vertices...
        this
            .addNormal(vector3)
            .addNormal(vector3)
            .addNormal(vector3);

        // Add the vertex cooordinates and texture info and store the index values...
        this._glIndices.push(
            this.addGLVertex(x1, y1, z1, uu1, vv1),
            this.addGLVertex(x2, y2, z2, uu2, vv2),
            this.addGLVertex(x3, y3, z3, uu3, vv3)
        );

        // Add a new triangle...
        // The center is needed to caculate the direction
        // of the triangle to the light source.
        this._triangles.push({
            vertices: [vertex1, vertex2, vertex3],
            lines:    [line1, line2, line3],
            normal:   vector3,
            center:   [(x1 + x2 + x3) / 3, (y1 + y2 + y3) / 3, (z1 + z2 + z3) / 3],
            visible:  false
        });

        return this;
    };

    /**
     * Create gl buffers for the object...
    **/
    createBuffers() {
        let gl = this._renderer.getGl();
        this._glPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._glPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._glVertices), gl.STATIC_DRAW);
        this._glPositionBuffer.itemSize = 3;

        this._glVertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._glVertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this._glIndices), gl.STATIC_DRAW);
        this._glVertexIndexBuffer.itemSize = 1;
        this._glVertexIndexBuffer.numItems = this._glIndices.length;

        this._glTextureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._glTextureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._glTextureCoords), gl.STATIC_DRAW);
        this._glTextureCoordBuffer.itemSize = 2;

        this._glNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._glNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._glNormals), gl.STATIC_DRAW);
        this._glNormalBuffer.itemSize = 3;
    };

    /**
     * Render the object...
    **/
    render() {
        let gl:            IGl              = this._renderer.getGl();
        let shaderProgram: IGlShaderProgram = this._renderer.getShaderProgram();

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        // Disable the color attribute, not needed because the object has a texture...
        gl.disableVertexAttribArray(shaderProgram.vertexColorAttribute);

        // Set the vertex position buffer...
        gl.bindBuffer(gl.ARRAY_BUFFER, this._glPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this._glPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        // Enable the normal attribute and set the buffer...
        gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._glNormalBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, this._glNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

        // Enable the texture coord attribute and set the buffer...
        gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._glTextureCoordBuffer);
        gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, this._glTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

        // Set the texture...
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.uniform1i(shaderProgram.samplerUniform, 0);

        // Don't use the color attribute...
        gl.uniform1i(shaderProgram.useColorUniform, 0);

        // Set the index, render the triangles...
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._glVertexIndexBuffer);
        this._renderer.setMatrixUniforms();
        gl.drawElements(gl.TRIANGLES, this._glVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }

    getVertices(): INumberList {
        return this._vertices;
    }

    getLines(): INumberList {
        return this._lines;
    }

    getTriangles(): INumberList {
        return this._triangles;
    }
}