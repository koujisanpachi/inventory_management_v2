// Firebase Webアプリ設定。Firebaseコンソール > プロジェクトの設定 > マイアプリ の値を転記してください。
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCQRKrO55jvyhhEOj5YHw_6sPJsG6pdJwQ",
  authDomain: "inventory-management-f6e76.firebaseapp.com",
  projectId: "inventory-management-f6e76",
  storageBucket: "inventory-management-f6e76.firebasestorage.app",
  messagingSenderId: "141464093340",
  appId: "1:141464093340:web:b3b919773cf67498e9a359"
};

// PINは携帯番号の下4桁。例の0000等は必ず実際の値に変更してください。
// 同じGoogleアカウントを共有するため、PINは本人確認ではなく操作記録用の簡易識別です。
window.INVENTORY_USERS = [
  { name: "kitade", pin: "3286" },
  { name: "kagawa", pin: "1599" },
  { name: "horiuchi", pin: "5939" },
  { name: "hamada", pin: "5937" },
  { name: "kinoshita", pin: "5938" }
];
