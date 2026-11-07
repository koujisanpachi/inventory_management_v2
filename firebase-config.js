// Firebase Webアプリ設定。Firebaseコンソール > プロジェクトの設定 > マイアプリ の値を転記してください。
window.FIREBASE_CONFIG = {
  apiKey: "ここにapiKey",
  authDomain: "inventory-management-f6e76.firebaseapp.com",
  projectId: "inventory-management-f6e76",
  storageBucket: "inventory-management-f6e76.firebasestorage.app",
  messagingSenderId: "ここにmessagingSenderId",
  appId: "ここにappId"
};

// PINは携帯番号の下4桁。例の0000等は必ず実際の値に変更してください。
// 同じGoogleアカウントを共有するため、PINは本人確認ではなく操作記録用の簡易識別です。
window.INVENTORY_USERS = [
  { name: "利用者1", pin: "0000" },
  { name: "利用者2", pin: "1111" },
  { name: "利用者3", pin: "2222" },
  { name: "利用者4", pin: "3333" },
  { name: "利用者5", pin: "4444" }
];
