// 방향의 source of truth — 이 각도 하나만 바꾸면 별과 로켓이 자동으로 맞춰짐
// 0 = 위, PI/4 = 좌상단 45도, PI/2 = 왼쪽
export const FLIGHT_ANGLE_Z = Math.PI * 0.28   // 약 50도 좌상단

// 화면에 보이는 비행 방향 벡터 (스크린 2D)
// 노즈가 향하는 방향: (-sin, +cos) = 좌상단
export const FLIGHT_SCREEN_X = -Math.sin(FLIGHT_ANGLE_Z)   // 음수 = 왼쪽
export const FLIGHT_SCREEN_Y =  Math.cos(FLIGHT_ANGLE_Z)   // 양수 = 위

// 별 이동 방향: 비행 방향의 반대 (우하단)
export const STAR_SPEED = 0.26
export const STAR_VX =  Math.sin(FLIGHT_ANGLE_Z) * STAR_SPEED   // 오른쪽
export const STAR_VY = -Math.cos(FLIGHT_ANGLE_Z) * STAR_SPEED   // 아래
export const STAR_VZ = 0.06   // 아주 작은 깊이감만

// 로켓 rotation — Z틸트로 좌상단, X로 살짝 화면 안쪽
export const ROCKET_ROTATION_X = -1.0   // 코를 화면 안으로
export const ROCKET_ROTATION_Y = 0.3    // 측면 살짝 보이기
export const ROCKET_ROTATION_Z = FLIGHT_ANGLE_Z   // 별과 동일한 각도
