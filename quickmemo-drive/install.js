(()=>{let pending;const button=document.getElementById('installMemoBtn');const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
if(installed())button.hidden=true;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();pending=e});
window.addEventListener('appinstalled',()=>{button.hidden=true;pending=null});
button.onclick=async()=>{if(pending){await pending.prompt();await pending.userChoice;pending=null;return}alert('순간메모 전용 아이콘 추가\n\n안드로이드: Chrome 메뉴(⋮) → 홈 화면에 추가 → 설치 또는 바로가기 만들기\n\n아이폰: Safari 공유 버튼 → 홈 화면에 추가\n\n이름이 「순간메모」인지 확인하세요. 기존 「나의 시스템」 아이콘은 그대로 사용할 수 있습니다.');};})();
