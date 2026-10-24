# Learn more 상품 수정

중간 박스(section2)와 3번째 박스(section3)는 서로 독립된 상품 1개를 표시합니다. Full Catalog의 화면·상품 데이터는 변경하지 않습니다.

## 화면에서 수정

1. 로고를 눌러 기존 관리자 모드에 로그인합니다.
2. 원하는 박스의 **상품 편집**을 누릅니다.
3. 상품명, 이미지 주소 또는 업로드, Shopify 상품 주소, 버튼 문구를 입력하고 저장합니다.
4. 저장 성공 안내 후 새로고침해도 해당 박스의 설정이 유지됩니다. 다른 박스와 Full Catalog에는 영향을 주지 않습니다.

선택 해제를 사용하면 해당 박스만 미지정 상태가 됩니다. 저장 실패가 표시되면 서버에 반영된 것이 아닙니다. 로컬에서만 대체하고 저장 성공처럼 표시하지 않습니다.

## 코드 기본값

hero-products.json의 section2와 section3를 각각 수정합니다. name / image / url / cta 필드가 있습니다. Firebase의 개별 저장값이 코드 기본값보다 우선합니다.

초기 상태는 중간 박스에 지정된 Dr.CPU 크림 1개, 3번째 박스는 미지정입니다. 임의의 두 번째 상품은 넣지 않습니다. 공개 상품 주소를 권장하며 Shopify 미리보기 주소는 만료될 수 있습니다.

## 저장 범위 및 보안

기존 Firebase의 learnMoreProducts/section2 또는 learnMoreProducts/section3에만 저장합니다. products 노드는 수정하지 않습니다. 기존 사이트의 브라우저 기반 관리자 인증을 사용하며 새 서버 인증이나 Firebase 규칙 변경은 포함하지 않습니다. 관리자 UI는 서버 측 접근 통제를 대체하지 않으므로 Firebase 보안 규칙은 별도로 관리해야 합니다. 비밀번호나 토큰은 문서나 설정 파일에 넣지 마세요.

## 검사

`node --test hero-products.test.js catalog-preservation.test.cjs`

기존 Full Catalog 마크업과 인라인 로직 보존, 독립 설정, URL 검증을 확인합니다.
