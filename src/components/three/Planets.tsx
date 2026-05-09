'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STAR_VX, STAR_VY } from '@/lib/scene-config'

const BOUND_X = 55
const BOUND_Y = 32

function move(pos: THREE.Vector3, dx: number, dy: number) {
  pos.x += dx; pos.y += dy
  if (pos.x >  BOUND_X) pos.x -= BOUND_X * 2
  if (pos.x < -BOUND_X) pos.x += BOUND_X * 2
  if (pos.y >  BOUND_Y) pos.y -= BOUND_Y * 2
  if (pos.y < -BOUND_Y) pos.y += BOUND_Y * 2
}

function depthParallax(z: number): number {
  return 0.10 * (22 / Math.abs(z))
}

function createRingParticleTexture(): THREE.CanvasTexture {
  const S = 32
  const canvas = document.createElement('canvas')
  canvas.width = S; canvas.height = S
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2)
  g.addColorStop(0,   'rgba(255,245,225,1)')
  g.addColorStop(0.3, 'rgba(232,215,185,0.6)')
  g.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(canvas)
}

// ── GLSL 공통 ─────────────────────────────────────────────────────────────────

const GLSL_VERTEX = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos    = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const GLSL_NOISE3 = /* glsl */`
  float hash3(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x),
          mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
          mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),
      f.z);
  }
  float fbm3(vec3 p) {
    float v=0.,a=0.5,n=0.;
    for(int i=0;i<5;i++){v+=noise3(p)*a;n+=a;a*=0.5;p*=2.;}
    return v/n;
  }
`

const GLSL_VORONOI = /* glsl */`
  vec3 hash3v(vec3 p) {
    return vec3(
      hash3(p),
      hash3(p + vec3(13.7, 5.3,  2.1)),
      hash3(p + vec3( 7.2,11.5,  4.8))
    );
  }
  float voronoi3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    float d = 8.0;
    for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
      vec3 b = vec3(float(x),float(y),float(z));
      vec3 r = b + hash3v(i+b) - f;
      d = min(d, dot(r,r));
    }
    return sqrt(d);
  }
`

const GLSL_LIGHT = /* glsl */`
  float diffuseLight(vec3 n) {
    return 0.08 + max(0.0, dot(normalize(n), normalize(vec3(4.0,6.0,3.0)))) * 0.92;
  }
`

// ── Shader Materials ──────────────────────────────────────────────────────────

function createGasGiantMaterial(
  [r0,g0,b0]: [number,number,number],
  [r1,g1,b1]: [number,number,number],
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      time:   { value: 0 },
      colorA: { value: new THREE.Color(r0/255, g0/255, b0/255) },
      colorB: { value: new THREE.Color(r1/255, g1/255, b1/255) },
    },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      uniform vec3  colorA, colorB;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_LIGHT}
      void main() {
        vec3  p  = normalize(vPos)*2.0;
        float t  = time*0.05;
        vec3 w1  = vec3(fbm3(p+vec3(0.3,       0.8+t*0.4, 0.1)),
                        fbm3(p+vec3(1.7+t*0.3,  0.1,       0.5)),
                        fbm3(p+vec3(0.5,         0.2,      0.9+t*0.2)))*2.4-1.2;
        vec3 w2  = vec3(fbm3(p+w1*0.9+vec3(0.0,    t*0.20,     0.3)),
                        fbm3(p+w1*0.9+vec3(1.1,0.4+t*0.15,     0.7)),
                        0.0)*1.8-0.9;
        vec3 wp  = p+w1+w2*0.5;
        float lat    = wp.y*2.5+fbm3(wp*1.5+t*0.08)*2.0;
        float band   = sin(lat*3.14159)*0.5+0.5;
        float turb   = fbm3(wp*3.0+t*0.12);
        float mixVal = clamp(band*0.62+turb*0.38,0.0,1.0);
        gl_FragColor = vec4(mix(colorA,colorB,mixVal)*diffuseLight(vNormal),1.0);
      }
    `,
  })
}

function createSaturnMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_LIGHT}
      void main() {
        vec3  p  = normalize(vPos)*2.0;
        float t  = time*0.025;
        vec3 w1  = vec3(fbm3(p+vec3(0.3,0.8+t*0.12,0.1))-0.5,
                        fbm3(p+vec3(1.7,0.1+t*0.08,0.4))-0.5, 0.0);
        vec3 wp  = p+w1*0.4;
        float lat    = wp.y*5.0+fbm3(wp*2.0+t*0.05)*0.8;
        float band   = sin(lat*3.14159)*0.5+0.5;
        float fine   = fbm3(wp*6.0+t*0.07)*0.12;
        float mixVal = clamp(band*0.88+fine,0.0,1.0);
        vec3 col = mix(vec3(0.659,0.529,0.314),vec3(0.922,0.824,0.635),mixVal);
        gl_FragColor = vec4(col*diffuseLight(vNormal),1.0);
      }
    `,
  })
}

function createTerrestrialMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_LIGHT}
      void main() {
        vec3  n3       = normalize(vPos);
        vec3  p        = n3*2.0;
        float h        = fbm3(p);
        float lat      = abs(n3.y);
        float snowLine = 0.84+fbm3(p*0.3+vec3(7.3))*0.1;
        vec3 col;
        if (lat > snowLine) {
          col = vec3(0.86,0.89,0.94);
        } else if (h < 0.42) {
          float depth   = h/0.42;
          float shimmer = fbm3(p*5.0+vec3(time*0.22,0.0,time*0.1))*0.04;
          col = vec3(0.03+depth*0.07+shimmer, 0.20+depth*0.32+shimmer, 0.50+depth*0.24);
        } else if (h < 0.48) {
          col = vec3(0.62,0.56,0.38);
        } else if (h < 0.72) {
          float tf = (h-0.48)/0.24;
          col = vec3(0.16+tf*0.11,0.31+tf*0.09,0.13+tf*0.03);
        } else if (h < 0.86) {
          float tf = (h-0.72)/0.14;
          col = vec3(0.35+tf*0.24,0.29+tf*0.16,0.23+tf*0.13);
        } else {
          col = vec3(0.85,0.88,0.91);
        }
        if (h >= 0.48 && lat < snowLine) {
          float facing = dot(normalize(vNormal),normalize(vec3(4.0,6.0,3.0)));
          float city   = pow(max(0.0,fbm3(p*4.5+vec3(0.5))-0.38)/0.62,2.5);
          col = mix(col,vec3(1.0,0.85,0.42),city*clamp(0.12-facing,0.0,0.12)*8.0);
        }
        gl_FragColor = vec4(col*diffuseLight(vNormal),1.0);
      }
    `,
  })
}

function createCloudMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_LIGHT}
      void main() {
        vec3  p     = normalize(vPos)*2.5;
        float t     = time*0.04;
        float c     = fbm3(p+vec3(t,t*0.4,t*0.2))-0.38;
        float alpha = clamp(c*4.5,0.0,1.0)*0.65;
        gl_FragColor = vec4(vec3(0.96,0.97,1.0)*(diffuseLight(vNormal)*0.5+0.5),alpha);
      }
    `,
  })
}

function createLavaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      void main() {
        vec3  p     = normalize(vPos)*3.0;
        float t     = time*0.04;
        float crust = fbm3(p+vec3(t*0.06));
        float crack = fbm3(p*1.5+vec3(t*0.14));
        float dark  = 0.024+crust*0.086;
        float lava  = pow(max(0.0,0.44-crack)/0.44,1.6);
        vec3 col = vec3(min(1.0,dark+lava),
                        min(1.0,dark*0.3+lava*lava*0.63),
                        min(1.0,dark*0.12+lava*lava*lava*0.16));
        col += vec3(1.0,0.38,0.0)*lava*0.5;
        float lit = 0.25+max(0.0,dot(normalize(vNormal),normalize(vec3(4.0,6.0,3.0))))*0.75;
        gl_FragColor = vec4(min(col*(lit+lava*0.4),vec3(1.0)),1.0);
      }
    `,
  })
}

function createIceMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_LIGHT}
      void main() {
        vec3  p  = normalize(vPos)*2.5;
        float t  = time*0.015;
        float h  = fbm3(p+vec3(t*0.10));
        float h2 = fbm3(p*2.0+vec3(1.3,0.7,0.4)+vec3(t*0.07));
        float br = 0.45+h*0.38+h2*0.17;
        float cl = 1.0-smoothstep(0.42,0.46,fbm3(p*2.0+vec3(1.7)));
        vec3 col = vec3(min(1.0,br*0.82),min(1.0,br*0.89),min(1.0,(br+0.08)*0.99));
        col -= vec3(0.16,0.27,0.45)*cl*0.35;
        col += vec3(0.8,0.92,1.0)*pow(fbm3(p*7.0+vec3(t*5.0)),7.0)*2.5;
        col  *= diffuseLight(vNormal)*0.6+0.4;
        vec3 ld = normalize(vec3(4.0,6.0,3.0));
        col += vec3(0.7,0.85,1.0)*pow(max(0.0,dot(reflect(-ld,normalize(vNormal)),vec3(0,0,1))),28.0)*0.6;
        gl_FragColor = vec4(min(col,vec3(1.0)),1.0);
      }
    `,
  })
}

// 보로노이 수정 표면 — 프리즘 반사 + 셀 경계 광채
function createCrystalMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_VORONOI}
      ${GLSL_LIGHT}
      void main() {
        vec3  p    = normalize(vPos)*3.0;
        float t    = time*0.008;
        float v    = voronoi3(p);
        float edge = 1.0-smoothstep(0.0,0.14,v);
        float intr = fbm3(p*1.5+vec3(t));
        // 보라↔파랑↔흰색 프리즘 팔레트
        vec3 cA  = vec3(0.52,0.62,0.92);
        vec3 cB  = vec3(0.80,0.72,0.98);
        vec3 col = mix(cA,cB,intr)*(0.35+intr*0.45);
        // 셀 경계 → 밝은 흰빛 광채
        col += vec3(0.75,0.80,1.0)*edge;
        // 스페큘러
        vec3 ld   = normalize(vec3(4.0,6.0,3.0));
        float spec = pow(max(0.0,dot(reflect(-ld,normalize(vNormal)),vec3(0,0,1))),80.0);
        col += vec3(1.0,0.95,1.0)*spec*1.2;
        col  *= diffuseLight(vNormal)*0.55+0.45;
        gl_FragColor = vec4(min(col,vec3(1.0)),1.0);
      }
    `,
  })
}

// 사이버펑크 도시 행성 — 보로노이 격자 + 구역별 네온 + 흐르는 펄스
function createNeonMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_VORONOI}
      void main() {
        vec3  p  = normalize(vPos)*3.0;
        float t  = time*0.07;

        // 두 스케일 보로노이
        float vC = voronoi3(p*1.8);
        float vF = voronoi3(p*4.2+vec3(1.7,0.9,2.3));

        // 선명한 격자 엣지
        float edgeC = 1.0-smoothstep(0.0, 0.18, vC);
        float edgeF = 1.0-smoothstep(0.0, 0.09, vF);
        // 격자 내부 후광 (아주 넓게)
        float haloC = 1.0-smoothstep(0.0, 0.55, vC);

        // 교차점 노드 — 작고 극도로 밝음
        float nodeC = pow(max(0.0, 0.22-vC)/0.22, 2.5)*8.0;
        float nodeF = pow(max(0.0, 0.14-vF)/0.14, 2.5)*5.0;

        // 격자를 흐르는 펄스
        float phaseC = fbm3(p*1.5)*6.28 - t*3.5;
        float phaseF = fbm3(p*2.5)*6.28 + t*2.8;
        float pulseC = pow(sin(phaseC)*0.5+0.5, 3.0);
        float pulseF = pow(sin(phaseF)*0.5+0.5, 3.0);

        // 구역별 네온 색 (천천히 변화)
        float zone = fbm3(p*0.7+vec3(t*0.015));
        vec3 nA = vec3(0.0,  1.0,  0.9);  // teal
        vec3 nB = vec3(0.9,  0.0,  1.0);  // violet
        vec3 nC = vec3(1.0,  0.08, 0.5);  // hot-pink
        vec3 mainCol   = zone < 0.5
                       ? mix(nA, nB, zone*2.0)
                       : mix(nB, nC, (zone-0.5)*2.0);
        vec3 accentCol = mainCol.yzx;

        // ── 베이스 (lit 적용) ────────────────────────────────────────────────────
        float lit  = 0.08 + max(0.0, dot(normalize(vNormal), normalize(vec3(4.0,6.0,3.0))))*0.55;
        vec3 base  = vec3(0.04, 0.025, 0.10) * lit;
        // 베이스에 희미한 후광 색조만 가산 (lit 無 — 도시 구역 분위기)
        base += mainCol * haloC * 0.14;

        // ── 네온 라인 (자체발광 — lit 곱셈 없음) ────────────────────────────────
        vec3 neon  = vec3(0.0);
        neon += mainCol   * edgeC * (2.2 + pulseC*3.0);
        neon += accentCol * edgeF * (1.1 + pulseF*1.8);
        // 노드 하이라이트
        neon += (mainCol*0.6 + vec3(1.0)*0.4) * nodeC;
        neon += accentCol * nodeF * 0.8;

        gl_FragColor = vec4(min(base + neon, vec3(1.0)), 1.0);
      }
    `,
  })
}

// 오로라 행성 — 느린 도메인 워프 × 빠른 커튼 진동 × 4색 레이어
function createAuroraMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_LIGHT}
      void main() {
        vec3  n  = normalize(vPos);
        vec3  p  = n*2.0;
        float tS = time*0.045;   // 느린 도메인 드리프트
        float tF = time*0.9;     // 빠른 커튼 진동

        // 느린 도메인 워프 — 오로라 형태를 불규칙하게
        float wx = fbm3(p+vec3(tS*0.5, 0.0,  tS*0.3))*1.4-0.7;
        float wy = fbm3(p+vec3(0.0, tS*0.6,  tS*0.2))*1.4-0.7;
        vec3  wp = p+vec3(wx,wy,0.0)*0.55;

        // 밝기 마스크 — fbm이 만드는 불규칙한 밝은 구역
        float m1 = pow(clamp(fbm3(wp*1.1+vec3(tS*0.4)),0.0,1.0),1.4)*1.6;
        float m2 = pow(clamp(fbm3(wp*1.4+vec3(0.0,tS*0.5,tS*0.2)),0.0,1.0),1.4)*1.6;
        float m3 = pow(clamp(fbm3(wp*0.9+vec3(tS*0.3,0.0,tS*0.45)),0.0,1.0),1.4)*1.6;
        float m4 = pow(clamp(fbm3(wp*1.6+vec3(tS*0.2,tS*0.35,0.0)),0.0,1.0),1.6)*1.4;

        // 빠른 커튼 진동 — atan 솔기 없이 n.x/n.z 직접 사용
        float c1 = pow(sin(n.x*4.2+n.z*2.8+wp.y*2.0+tF*0.85)*0.5+0.5, 2.8)*m1;
        float c2 = pow(sin(n.z*3.8-n.x*2.2+wp.x*1.8-tF*1.05)*0.5+0.5, 2.8)*m2;
        float c3 = pow(sin(n.x*5.5+n.y*3.0+wp.z*2.5+tF*0.72)*0.5+0.5, 3.2)*m3;
        float c4 = pow(sin(n.z*2.8+n.y*4.5-wp.y*2.2-tF*0.95)*0.5+0.5, 3.0)*m4;

        // 4색 오로라 레이어
        vec3 aurora = vec3(0.04,0.95,0.38)*c1    // 에메랄드
                    + vec3(0.0, 0.55,0.95)*c2    // 시안
                    + vec3(0.72,0.06,0.95)*c3    // 바이올렛
                    + vec3(0.95,0.55,0.08)*c4;   // 골드-오렌지 (환상적 색)

        // 밝은 구역 내 반짝임
        float scint = pow(noise3(wp*11.0+vec3(tF*3.5)),9.0)*3.0;
        aurora += vec3(0.85,1.0,0.72)*scint*(c1+c2)*0.45;
        aurora += vec3(1.0,0.85,1.0)*scint*(c3+c4)*0.35;

        float rock = fbm3(p*4.0)*0.045;
        vec3  col  = vec3(0.01,0.015,0.04)+vec3(rock);
        col  += aurora;
        col  *= diffuseLight(vNormal)*0.22+0.04;
        col  += aurora*0.48; // 강한 자체 발광
        gl_FragColor = vec4(min(col,vec3(1.0)),1.0);
      }
    `,
  })
}

// 전체 해양 행성 — 깊은 바다 + 생물발광 + 파도 반사
function createOceanMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_LIGHT}
      void main() {
        vec3  p     = normalize(vPos)*2.0;
        float t     = time*0.08;
        float depth = fbm3(p);
        float waves = fbm3(p*5.0+vec3(t*0.25,0.0,t*0.18));
        float blend = smoothstep(0.4,0.6,depth);
        vec3 col    = mix(
          mix(vec3(0.01,0.06,0.22), vec3(0.02,0.15,0.40), depth),
          vec3(0.04,0.32,0.52),
          blend);
        col += vec3(0.28,0.52,0.82)*pow(waves,3.0)*0.20;
        // 생물발광
        float bio = pow(fbm3(p*8.0+vec3(t*0.55)),4.0);
        col += vec3(0.0,0.92,0.68)*bio*0.65;
        col *= diffuseLight(vNormal)*0.7+0.3;
        // 수면 스페큘러
        vec3 ld = normalize(vec3(4.0,6.0,3.0));
        float spec = pow(max(0.0,dot(reflect(-ld,normalize(vNormal)),vec3(0,0,1))),52.0);
        col += vec3(0.5,0.72,1.0)*spec*0.55;
        gl_FragColor = vec4(min(col,vec3(1.0)),1.0);
      }
    `,
  })
}

// 황산성 독성 행성 — 끓어오르는 산성 구름 + 형광 웅덩이
function createAcidMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float time;
      varying vec3  vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_LIGHT}
      void main() {
        vec3  p  = normalize(vPos)*2.5;
        float t  = time*0.06;
        float n1 = fbm3(p*1.5+vec3(t*0.12,0.0,t*0.08));
        float n2 = fbm3(p*3.0+vec3(0.0,t*0.18,t*0.10));
        float acid = n1*0.65+n2*0.35;
        vec3 col = mix(vec3(0.06,0.14,0.01),vec3(0.62,0.90,0.04),acid);
        float hot  = pow(fbm3(p*6.0+vec3(t*0.28)),3.0);
        col += vec3(0.92,1.0,0.0)*hot*0.55;
        float pool = smoothstep(0.58,0.65,n1);
        col = mix(col,vec3(0.78,1.0,0.08),pool*0.72);
        col *= diffuseLight(vNormal)*0.82+0.18;
        gl_FragColor = vec4(min(col,vec3(1.0)),1.0);
      }
    `,
  })
}

function createAsteroidMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: GLSL_VERTEX,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying vec3 vNormal, vPos;
      ${GLSL_NOISE3}
      ${GLSL_LIGHT}
      void main() {
        float h = fbm3(normalize(vPos)*2.0);
        float v = 0.24+h*0.21;
        gl_FragColor = vec4(vec3(v*0.84,v*0.78,v*0.71)*diffuseLight(vNormal),1.0);
      }
    `,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function GlowMesh({ r, scale, color, emissive, opacity }: {
  r: number; scale: number; color: string; emissive: string; opacity: number
}) {
  return (
    <mesh scale={[scale,scale,scale]}>
      <sphereGeometry args={[r,24,24]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.5}
        transparent opacity={opacity} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

function usePlanetFrame(
  groupRef: { current: THREE.Group | null },
  Z: number,
  mat: THREE.ShaderMaterial,
  meshRef?: { current: THREE.Mesh | null },
  rotSpeed = 0.03,
  extraRef?: { current: THREE.Mesh | null },
  extraRot = 0,
  extraMat?: THREE.ShaderMaterial,
) {
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const d = Math.min(delta, 0.05)
    const p = depthParallax(Z)
    move(groupRef.current.position, STAR_VX*d*60*p, STAR_VY*d*60*p)
    if (meshRef?.current) meshRef.current.rotation.y += d*rotSpeed
    if (extraRef?.current) extraRef.current.rotation.y += d*extraRot
    mat.uniforms.time.value += d
    if (extraMat) extraMat.uniforms.time.value += d
  })
}

// ── Planet Components ─────────────────────────────────────────────────────────

function LargePlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => createGasGiantMaterial([148,92,48],[232,198,148]), [])
  const Z = -38
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.025)
  return (
    <group ref={groupRef} position={[-20,7,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[6.0,64,64]} /></mesh>
      <GlowMesh r={6.0} scale={1.025} color="#cc8844" emissive="#aa6622" opacity={0.045} />
    </group>
  )
}

function SmallPlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => createGasGiantMaterial([58,82,140],[168,198,228]), [])
  const Z = -27
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.045)
  return (
    <group ref={groupRef} position={[14,-5,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[2.2,48,48]} /></mesh>
      <GlowMesh r={2.2} scale={1.07} color="#7799dd" emissive="#4466bb" opacity={0.045} />
    </group>
  )
}

function TerrestrialPlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const cloudRef  = useRef<THREE.Mesh>(null)
  const mat      = useMemo(() => createTerrestrialMaterial(), [])
  const cloudMat = useMemo(() => createCloudMaterial(), [])
  const Z = -47
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.035, cloudRef, 0.055, cloudMat)
  return (
    <group ref={groupRef} position={[-30,-12,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[4.0,64,64]} /></mesh>
      <mesh ref={cloudRef} material={cloudMat} scale={[1.022,1.022,1.022]}>
        <sphereGeometry args={[4.0,48,48]} />
      </mesh>
      <GlowMesh r={4.0} scale={1.05} color="#6699cc" emissive="#3366bb" opacity={0.035} />
    </group>
  )
}

function LavaPlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const mat       = useMemo(() => createLavaMaterial(), [])
  const Z = -33
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.06)
  return (
    <group ref={groupRef} position={[26,-13,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[2.8,64,64]} /></mesh>
      <GlowMesh r={2.8} scale={1.08} color="#ff5510" emissive="#ee3300" opacity={0.06} />
    </group>
  )
}

function IcePlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const mat       = useMemo(() => createIceMaterial(), [])
  const Z = -52
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.022)
  return (
    <group ref={groupRef} position={[-12,17,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[5.0,64,64]} /></mesh>
      <GlowMesh r={5.0} scale={1.05} color="#99ccff" emissive="#5599ee" opacity={0.035} />
    </group>
  )
}

function SaturnPlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const ringRef   = useRef<THREE.Points>(null)
  const mat         = useMemo(() => createSaturnMaterial(), [])
  const particleTex = useMemo(() => createRingParticleTexture(), [])
  const ringPositions = useMemo(() => {
    const count = 50000
    const arr   = new Float32Array(count*3)
    for (let i = 0; i < count; i++) {
      const angle = Math.random()*Math.PI*2
      const band  = Math.random()
      let r: number
      if      (band < 0.03) r = 5.0  + Math.random()*0.8
      else if (band < 0.15) r = 5.8  + Math.random()*1.7
      else if (band < 0.73) r = 7.5  + Math.random()*3.0
      else if (band < 0.75) r = 10.5 + Math.random()*0.7
      else                  r = 11.2 + Math.random()*2.3
      arr[i*3]   = Math.cos(angle)*r
      arr[i*3+1] = (Math.random()-0.5)*0.05
      arr[i*3+2] = Math.sin(angle)*r
    }
    return arr
  }, [])
  const Z = -43
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const d = Math.min(delta, 0.05)
    const p = depthParallax(Z)
    move(groupRef.current.position, STAR_VX*d*60*p, STAR_VY*d*60*p)
    if (planetRef.current) planetRef.current.rotation.y += d*0.03
    if (ringRef.current)   ringRef.current.rotation.y   += d*0.045
    mat.uniforms.time.value += d
  })
  return (
    <group ref={groupRef} position={[5,8,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[3.5,64,64]} /></mesh>
      <GlowMesh r={3.5} scale={1.05} color="#ccaa55" emissive="#aa8833" opacity={0.035} />
      <group rotation={[0.12,0,0.14]}>
        <points ref={ringRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[ringPositions,3]} />
          </bufferGeometry>
          <pointsMaterial map={particleTex} color="#ccc0a0" size={0.08} sizeAttenuation
            transparent opacity={0.72} depthWrite={false} blending={THREE.NormalBlending} />
        </points>
      </group>
    </group>
  )
}

function CrystalPlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const mat       = useMemo(() => createCrystalMaterial(), [])
  const Z = -36
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.018)
  return (
    <group ref={groupRef} position={[22,13,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[3.0,64,64]} /></mesh>
      <GlowMesh r={3.0} scale={1.04} color="#aabbff" emissive="#8899ff" opacity={0.055} />
    </group>
  )
}

function NeonPlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const mat       = useMemo(() => createNeonMaterial(), [])
  const Z = -44
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.038)
  return (
    <group ref={groupRef} position={[-22,-11,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[3.5,64,64]} /></mesh>
      <GlowMesh r={3.5} scale={1.04} color="#330066" emissive="#220044" opacity={0.06} />
    </group>
  )
}

function AuroraPlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const mat       = useMemo(() => createAuroraMaterial(), [])
  const Z = -50
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.028)
  return (
    <group ref={groupRef} position={[14,-17,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[4.2,64,64]} /></mesh>
      <GlowMesh r={4.2} scale={1.04} color="#22ffaa" emissive="#00cc77" opacity={0.05} />
    </group>
  )
}

function OceanPlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const mat       = useMemo(() => createOceanMaterial(), [])
  const Z = -30
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.042)
  return (
    <group ref={groupRef} position={[-32,4,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[3.2,64,64]} /></mesh>
      <GlowMesh r={3.2} scale={1.05} color="#2255cc" emissive="#1133aa" opacity={0.04} />
    </group>
  )
}

function AcidPlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const mat       = useMemo(() => createAcidMaterial(), [])
  const Z = -40
  usePlanetFrame(groupRef, Z, mat, planetRef, 0.052)
  return (
    <group ref={groupRef} position={[30,-7,Z]}>
      <mesh ref={planetRef} material={mat}><sphereGeometry args={[2.6,64,64]} /></mesh>
      <GlowMesh r={2.6} scale={1.06} color="#88cc00" emissive="#66aa00" opacity={0.055} />
    </group>
  )
}

function Asteroid() {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => createAsteroidMaterial(), [])
  const Z = -22
  useFrame((_, delta) => {
    if (!ref.current) return
    const d = Math.min(delta, 0.05)
    ref.current.rotation.x += d*0.38
    ref.current.rotation.z += d*0.24
    move(ref.current.position, STAR_VX*d*60*depthParallax(Z), STAR_VY*d*60*depthParallax(Z))
  })
  return (
    <mesh ref={ref} material={mat} position={[22,10,Z]} scale={[1.0,0.72,0.85]}>
      <icosahedronGeometry args={[1.1,1]} />
    </mesh>
  )
}

export default function Planets() {
  return (
    <>
      <LargePlanet />
      <SmallPlanet />
      <TerrestrialPlanet />
      <LavaPlanet />
      <IcePlanet />
      <SaturnPlanet />
      <CrystalPlanet />
      <NeonPlanet />
      <AuroraPlanet />
      <OceanPlanet />
      <AcidPlanet />
      <Asteroid />
    </>
  )
}
