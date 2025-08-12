// Apply the saved theme to <body> on every page
(function(){
  try{
    const meta = JSON.parse(localStorage.getItem('budgeteer_meta')||'{}');
    document.body.setAttribute('data-theme', meta.theme || 'blue');
  }catch(_){
    document.body.setAttribute('data-theme','blue');
  }
})();
