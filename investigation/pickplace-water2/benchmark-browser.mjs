// Benchmark supervision only; generation and acceptance are unchanged.
export async function installBudget(page,budgetMs){
  await page.evaluate(budgetMs=>{
    window.benchConvert=async input=>{
      let timedOut=false;
      const timer=setTimeout(()=>{
        timedOut=true;
        // The survey calls the API directly, so this button stays disabled.
        // Dispatch its existing cancellation handler explicitly.
        document.querySelector('#cancel').dispatchEvent(new Event('click'));
      },budgetMs);
      try{return await window.pickplace.convert(input);}
      catch(e){if(timedOut)throw Error(`Benchmark timeout after ${budgetMs} ms`);throw e;}
      finally{clearTimeout(timer);}
    };
  },budgetMs);
}
