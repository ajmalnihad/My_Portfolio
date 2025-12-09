(function () {
    // Configuration Options
    const defaultOptions = {
        mouseForce: 20,
        cursorSize: 100,
        isViscous: false,
        viscous: 30,
        iterationsViscous: 32,
        iterationsPoisson: 32,
        dt: 0.014,
        BFECC: true,
        resolution: 0.5,
        isBounce: false,
        colors: ['#5227FF', '#FF9FFC', '#B19EEF'], // Your colors
        autoDemo: true,
        autoSpeed: 0.5,
        autoIntensity: 2.2,
        takeoverDuration: 0.25,
        autoResumeDelay: 1000,
        autoRampDuration: 0.6
    };

    window.LiquidEther = function (containerId, options = {}) {
        const config = { ...defaultOptions, ...options };
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.error("Container not found");
            return;
        }

        // --- Shaders ---
        const face_vert = `attribute vec3 position; uniform vec2 px; uniform vec2 boundarySpace; varying vec2 uv; void main(){ vec3 pos = position; vec2 scale = 1.0 - boundarySpace * 2.0; pos.xy = pos.xy * scale; uv = vec2(0.5)+(pos.xy)*0.5; gl_Position = vec4(pos, 1.0); }`;
        const line_vert = `attribute vec3 position; uniform vec2 px; varying vec2 uv; void main(){ vec3 pos = position; uv = 0.5 + pos.xy * 0.5; vec2 n = sign(pos.xy); pos.xy = abs(pos.xy) - px * 1.0; pos.xy *= n; gl_Position = vec4(pos, 1.0); }`;
        const mouse_vert = `attribute vec3 position; attribute vec2 uv; uniform vec2 center; uniform vec2 scale; uniform vec2 px; varying vec2 vUv; void main(){ vec2 pos = position.xy * scale * 2.0 * px + center; vUv = uv; gl_Position = vec4(pos, 0.0, 1.0); }`;
        const advection_frag = `precision highp float; uniform sampler2D velocity; uniform float dt; uniform bool isBFECC; uniform vec2 fboSize; uniform vec2 px; varying vec2 uv; void main(){ vec2 ratio = max(fboSize.x, fboSize.y) / fboSize; if(isBFECC == false){ vec2 vel = texture2D(velocity, uv).xy; vec2 uv2 = uv - vel * dt * ratio; vec2 newVel = texture2D(velocity, uv2).xy; gl_FragColor = vec4(newVel, 0.0, 0.0); } else { vec2 spot_new = uv; vec2 vel_old = texture2D(velocity, uv).xy; vec2 spot_old = spot_new - vel_old * dt * ratio; vec2 vel_new1 = texture2D(velocity, spot_old).xy; vec2 spot_new2 = spot_old + vel_new1 * dt * ratio; vec2 error = spot_new2 - spot_new; vec2 spot_new3 = spot_new - error / 2.0; vec2 vel_2 = texture2D(velocity, spot_new3).xy; vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio; vec2 newVel2 = texture2D(velocity, spot_old2).xy; gl_FragColor = vec4(newVel2, 0.0, 0.0); } }`;
        const color_frag = `precision highp float; uniform sampler2D velocity; uniform sampler2D palette; uniform vec4 bgColor; varying vec2 uv; void main(){ vec2 vel = texture2D(velocity, uv).xy; float lenv = clamp(length(vel), 0.0, 1.0); vec3 c = texture2D(palette, vec2(lenv, 0.5)).rgb; vec3 outRGB = mix(bgColor.rgb, c, lenv); float outA = mix(bgColor.a, 1.0, lenv); gl_FragColor = vec4(outRGB, outA); }`;
        const divergence_frag = `precision highp float; uniform sampler2D velocity; uniform float dt; uniform vec2 px; varying vec2 uv; void main(){ float x0 = texture2D(velocity, uv-vec2(px.x, 0.0)).x; float x1 = texture2D(velocity, uv+vec2(px.x, 0.0)).x; float y0 = texture2D(velocity, uv-vec2(0.0, px.y)).y; float y1 = texture2D(velocity, uv+vec2(0.0, px.y)).y; float divergence = (x1 - x0 + y1 - y0) / 2.0; gl_FragColor = vec4(divergence / dt); }`;
        const externalForce_frag = `precision highp float; uniform vec2 force; uniform vec2 center; uniform vec2 scale; uniform vec2 px; varying vec2 vUv; void main(){ vec2 circle = (vUv - 0.5) * 2.0; float d = 1.0 - min(length(circle), 1.0); d *= d; gl_FragColor = vec4(force * d, 0.0, 1.0); }`;
        const poisson_frag = `precision highp float; uniform sampler2D pressure; uniform sampler2D divergence; uniform vec2 px; varying vec2 uv; void main(){ float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r; float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r; float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r; float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r; float div = texture2D(divergence, uv).r; float newP = (p0 + p1 + p2 + p3) / 4.0 - div; gl_FragColor = vec4(newP); }`;
        const pressure_frag = `precision highp float; uniform sampler2D pressure; uniform sampler2D velocity; uniform vec2 px; uniform float dt; varying vec2 uv; void main(){ float step = 1.0; float p0 = texture2D(pressure, uv + vec2(px.x * step, 0.0)).r; float p1 = texture2D(pressure, uv - vec2(px.x * step, 0.0)).r; float p2 = texture2D(pressure, uv + vec2(0.0, px.y * step)).r; float p3 = texture2D(pressure, uv - vec2(0.0, px.y * step)).r; vec2 v = texture2D(velocity, uv).xy; vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5; v = v - gradP * dt; gl_FragColor = vec4(v, 0.0, 1.0); }`;
        const viscous_frag = `precision highp float; uniform sampler2D velocity; uniform sampler2D velocity_new; uniform float v; uniform vec2 px; uniform float dt; varying vec2 uv; void main(){ vec2 old = texture2D(velocity, uv).xy; vec2 new0 = texture2D(velocity_new, uv + vec2(px.x * 2.0, 0.0)).xy; vec2 new1 = texture2D(velocity_new, uv - vec2(px.x * 2.0, 0.0)).xy; vec2 new2 = texture2D(velocity_new, uv + vec2(0.0, px.y * 2.0)).xy; vec2 new3 = texture2D(velocity_new, uv - vec2(0.0, px.y * 2.0)).xy; vec2 newv = 4.0 * old + v * dt * (new0 + new1 + new2 + new3); newv /= 4.0 * (1.0 + v * dt); gl_FragColor = vec4(newv, 0.0, 0.0); }`;

        // --- Helper Functions ---
        function makePaletteTexture(stops) {
            let arr = (Array.isArray(stops) && stops.length > 0) ? stops : ['#ffffff', '#ffffff'];
            if(arr.length === 1) arr = [arr[0], arr[0]];
            const w = arr.length;
            const data = new Uint8Array(w * 4);
            for (let i = 0; i < w; i++) {
                const c = new THREE.Color(arr[i]);
                data[i * 4 + 0] = Math.round(c.r * 255);
                data[i * 4 + 1] = Math.round(c.g * 255);
                data[i * 4 + 2] = Math.round(c.b * 255);
                data[i * 4 + 3] = 255;
            }
            const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
            tex.magFilter = THREE.LinearFilter;
            tex.minFilter = THREE.LinearFilter;
            tex.needsUpdate = true;
            return tex;
        }

        // --- Classes ---
        class CommonClass {
            constructor() {
                this.width = 0; this.height = 0; this.aspect = 1; this.pixelRatio = 1;
                this.container = null; this.renderer = null; this.clock = null;
            }
            init(container) {
                this.container = container;
                this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
                this.resize();
                this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                this.renderer.autoClear = false;
                this.renderer.setPixelRatio(this.pixelRatio);
                this.renderer.setSize(this.width, this.height);
                this.container.appendChild(this.renderer.domElement);
                this.clock = new THREE.Clock();
                this.clock.start();
            }
            resize() {
                if (!this.container) return;
                const rect = this.container.getBoundingClientRect();
                this.width = rect.width; this.height = rect.height;
                this.aspect = this.width / this.height;
                if (this.renderer) this.renderer.setSize(this.width, this.height, false);
            }
            update() { this.clock.getDelta(); }
        }
        const Common = new CommonClass();

        class MouseClass {
            constructor() {
                this.coords = new THREE.Vector2(); this.coords_old = new THREE.Vector2();
                this.diff = new THREE.Vector2(); this.isHoverInside = false;
                this.init();
            }
            init() {
                window.addEventListener('mousemove', e => this.onMove(e.clientX, e.clientY));
                window.addEventListener('touchstart', e => this.onMove(e.touches[0].clientX, e.touches[0].clientY));
                window.addEventListener('touchmove', e => this.onMove(e.touches[0].clientX, e.touches[0].clientY));
            }
            onMove(x, y) {
                if(!Common.container) return;
                const rect = Common.container.getBoundingClientRect();
                this.isHoverInside = (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
                if(this.isHoverInside) {
                    const nx = (x - rect.left) / rect.width;
                    const ny = (y - rect.top) / rect.height;
                    this.coords.set(nx * 2 - 1, -(ny * 2 - 1));
                }
            }
            update() {
                this.diff.subVectors(this.coords, this.coords_old);
                this.coords_old.copy(this.coords);
                if(!this.isHoverInside) this.diff.set(0,0);
            }
        }
        const Mouse = new MouseClass();

        class ShaderPass {
            constructor(props) {
                this.props = props;
                this.uniforms = this.props.material?.uniforms;
                this.scene = new THREE.Scene();
                this.camera = new THREE.Camera();
                if(this.uniforms) {
                    this.material = new THREE.RawShaderMaterial(this.props.material);
                    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(2,2), this.material);
                    this.scene.add(this.plane);
                }
            }
            update() {
                Common.renderer.setRenderTarget(this.props.output || null);
                Common.renderer.render(this.scene, this.camera);
                Common.renderer.setRenderTarget(null);
            }
        }

        // --- Simulation Classes ---
        class ExternalForce extends ShaderPass {
            constructor(simProps) {
                super({ output: simProps.dst });
                const mouseM = new THREE.RawShaderMaterial({
                    vertexShader: mouse_vert, fragmentShader: externalForce_frag,
                    blending: THREE.AdditiveBlending, depthWrite: false,
                    uniforms: {
                        px: { value: simProps.cellScale },
                        force: { value: new THREE.Vector2(0,0) },
                        center: { value: new THREE.Vector2(0,0) },
                        scale: { value: new THREE.Vector2(config.cursorSize, config.cursorSize) }
                    }
                });
                this.mouse = new THREE.Mesh(new THREE.PlaneGeometry(1,1), mouseM);
                this.scene.add(this.mouse);
            }
            update(props) {
                const forceX = (Mouse.diff.x / 2) * props.mouse_force;
                const forceY = (Mouse.diff.y / 2) * props.mouse_force;
                const cursorSizeX = props.cursor_size * props.cellScale.x;
                const cursorSizeY = props.cursor_size * props.cellScale.y;
                const centerX = Math.min(Math.max(Mouse.coords.x, -1 + cursorSizeX + props.cellScale.x * 2), 1 - cursorSizeX - props.cellScale.x * 2);
                const centerY = Math.min(Math.max(Mouse.coords.y, -1 + cursorSizeY + props.cellScale.y * 2), 1 - cursorSizeY - props.cellScale.y * 2);
                this.mouse.material.uniforms.force.value.set(forceX, forceY);
                this.mouse.material.uniforms.center.value.set(centerX, centerY);
                this.mouse.material.uniforms.scale.value.set(props.cursor_size, props.cursor_size);
                super.update();
            }
        }

        class Simulation {
            constructor() {
                this.fbos = {};
                this.fboSize = new THREE.Vector2();
                this.cellScale = new THREE.Vector2();
                this.init();
            }
            init() {
                this.calcSize();
                const type = (/(iPad|iPhone|iPod)/i.test(navigator.userAgent)) ? THREE.HalfFloatType : THREE.FloatType;
                const opts = { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
                ['vel_0', 'vel_1', 'div', 'pressure_0', 'pressure_1'].forEach(k => {
                    this.fbos[k] = new THREE.WebGLRenderTarget(this.fboSize.x, this.fboSize.y, opts);
                });
                
                this.externalForce = new ExternalForce({ cellScale: this.cellScale, dst: this.fbos.vel_1, cursor_size: config.cursorSize });
                
                this.advection = new ShaderPass({
                    material: { vertexShader: face_vert, fragmentShader: advection_frag, uniforms: { boundarySpace: { value: this.cellScale }, px: { value: this.cellScale }, fboSize: { value: this.fboSize }, velocity: { value: this.fbos.vel_0.texture }, dt: { value: config.dt }, isBFECC: { value: true } }},
                    output: this.fbos.vel_1
                });
                
                this.divergence = new ShaderPass({
                    material: { vertexShader: face_vert, fragmentShader: divergence_frag, uniforms: { boundarySpace: { value: this.cellScale }, velocity: { value: this.fbos.vel_1.texture }, px: { value: this.cellScale }, dt: { value: config.dt } }},
                    output: this.fbos.div
                });
                
                this.poisson = new ShaderPass({
                    material: { vertexShader: face_vert, fragmentShader: poisson_frag, uniforms: { boundarySpace: { value: this.cellScale }, pressure: { value: this.fbos.pressure_0.texture }, divergence: { value: this.fbos.div.texture }, px: { value: this.cellScale } }},
                    output: this.fbos.pressure_1
                });
                
                this.pressure = new ShaderPass({
                    material: { vertexShader: face_vert, fragmentShader: pressure_frag, uniforms: { boundarySpace: { value: this.cellScale }, pressure: { value: this.fbos.pressure_1.texture }, velocity: { value: this.fbos.vel_1.texture }, px: { value: this.cellScale }, dt: { value: config.dt } }},
                    output: this.fbos.vel_0
                });
            }
            calcSize() {
                const width = Math.round(config.resolution * Common.width);
                const height = Math.round(config.resolution * Common.height);
                this.cellScale.set(1.0 / width, 1.0 / height);
                this.fboSize.set(width, height);
            }
            resize() { this.calcSize(); Object.values(this.fbos).forEach(f => f.setSize(this.fboSize.x, this.fboSize.y)); }
            update() {
                this.advection.uniforms.dt.value = config.dt;
                this.advection.update();
                this.externalForce.update({ cursor_size: config.cursorSize, mouse_force: config.mouseForce, cellScale: this.cellScale });
                this.divergence.uniforms.velocity.value = this.fbos.vel_1.texture;
                this.divergence.update();
                
                let p_in = this.fbos.pressure_0, p_out = this.fbos.pressure_1;
                for(let i=0; i<config.iterationsPoisson; i++) {
                    this.poisson.uniforms.pressure.value = p_in.texture;
                    this.poisson.props.output = p_out;
                    this.poisson.update();
                    [p_in, p_out] = [p_out, p_in];
                }
                
                this.pressure.uniforms.pressure.value = p_in.texture;
                this.pressure.update();
            }
        }

        // --- Main Initialization ---
        Common.init(container);
        Mouse.init();

        const simulation = new Simulation();
        const paletteTex = makePaletteTexture(config.colors);
        const outputMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.RawShaderMaterial({
                vertexShader: face_vert, fragmentShader: color_frag,
                transparent: true, depthWrite: false,
                uniforms: {
                    velocity: { value: simulation.fbos.vel_0.texture },
                    palette: { value: paletteTex },
                    bgColor: { value: new THREE.Vector4(0,0,0,0) }
                }
            })
        );
        const outputScene = new THREE.Scene();
        outputScene.add(outputMesh);
        const outputCamera = new THREE.Camera();

        function animate() {
            requestAnimationFrame(animate);
            Mouse.update();
            Common.update();
            simulation.update();
            Common.renderer.setRenderTarget(null);
            Common.renderer.render(outputScene, outputCamera);
        }

        window.addEventListener('resize', () => {
            Common.resize();
            simulation.resize();
        });

        animate();
    };
})();