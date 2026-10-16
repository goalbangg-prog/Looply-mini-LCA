"""브라우저 스모크 테스트 (Playwright). 실행: python tests/e2e_smoke.py
차트 라이브러리(Plotly)는 기록용 스텁으로 대체하므로 차트 모양이 아닌 동작·데이터 흐름을 검증한다."""
import asyncio
from playwright.async_api import async_playwright
import os
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUB="""window.__plots={};window.Plotly={newPlot:(e,t,l)=>{window.__plots[e.id]={t:t,l:l};e.classList.add('js-plotly-plot');e.innerHTML='<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#9ab;background:#f3f6fb;border-radius:8px">[차트 영역]</div>'},purge(e){e.classList.remove('js-plotly-plot')},Plots:{resize(){}}};"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--no-sandbox"])
        ctx=await b.new_context(viewport={"width":1280,"height":900},accept_downloads=True)
        pg=await ctx.new_page(); errs=[]
        pg.on("pageerror",lambda e:errs.append("PE "+str(e)))
        pg.on("console",lambda m:errs.append("CE "+m.text) if m.type=="error" else None)
        await pg.route("**/plotly*.js",lambda r:r.fulfill(body=STUB,content_type="application/javascript"))
        await pg.goto("file://"+BASE+"/index.html"); await pg.wait_for_timeout(700)
        # scatter same axis: message must replace chart
        await pg.select_option("#rsY","탄소"); await pg.wait_for_timeout(100)
        print("same-axis chart html:",(await pg.inner_html("#chScatter"))[:120], "| has plot class:",await pg.evaluate("chScatter.classList.contains('js-plotly-plot')"))
        await pg.select_option("#rsY","물")
        print("after restore plot class:",await pg.evaluate("chScatter.classList.contains('js-plotly-plot')"))
        txt=await pg.inner_text("#report"); print("보유율 in report:", "보유율" in txt)
        # calc
        await pg.click('[data-tab="calc"]'); await pg.wait_for_timeout(300)
        await pg.click("#example"); await pg.wait_for_timeout(400)
        res=await pg.inner_text("#results"); print("metric sample:",res[:200].replace("\n"," | "))
        print("출처 in results:", "출처" in res, "| kg Sb eq · in results:", "kg Sb eq ·" in res)
        print(res[res.index("일상 속"):res.index("일상 속")+700].replace("\n"," | "))
        print("MC:",(await pg.inner_text("#mc"))[:330].replace("\n"," | "))
        await pg.select_option("#mcGsd","2"); await pg.wait_for_timeout(200)
        print("MC gsd2:",(await pg.inner_text("#mc"))[:120].replace("\n"," | "))
        await pg.select_option("#mcImp","4"); await pg.wait_for_timeout(200)
        print("MC water:",(await pg.inner_text("#mc"))[:120].replace("\n"," | "))
        # explore radar
        await pg.click('[data-tab="explore"]'); await pg.wait_for_timeout(300)
        await pg.select_option("#exMode","radar"); await pg.wait_for_timeout(200)
        opts=await pg.evaluate("[...document.querySelectorAll('[data-rad]')[0].options].length"); print("radar options:",opts)
        vals=await pg.evaluate("[...document.querySelectorAll('[data-rad]')[0].querySelectorAll('option')].map(o=>[o.value,o.textContent]).filter(x=>['유리면','골판지','알루미늄 판'].includes(x[1]))"); print(vals)
        await pg.select_option('[data-rad="0"]',vals[0][0]); await pg.wait_for_timeout(150)
        await pg.select_option('[data-rad="0"]',vals[1][0]); await pg.wait_for_timeout(150)  # change after choosing
        await pg.select_option('[data-rad="1"]',vals[2][0]); await pg.wait_for_timeout(200)
        print("radar traces:",await pg.evaluate("__plots.exChart.t.map(t=>t.name)"))
        # cluster find
        await pg.click('[data-tab="cluster"]'); await pg.wait_for_timeout(500)
        await pg.select_option("#clFind",label="유리면"); await pg.wait_for_timeout(200)
        print("find:",(await pg.inner_text("#clFound"))[:120].replace("\n"," "))
        await pg.select_option("#clFind",label="골판지"); await pg.wait_for_timeout(200)
        print("find2:",(await pg.inner_text("#clFound"))[:60].replace("\n"," "))
        await pg.click('[data-tab="notes"]'); await pg.wait_for_timeout(500)
        print("notes len:",len(await pg.inner_text("#notes")))
        await pg.click('[data-tab="report"]'); await pg.wait_for_timeout(300)
        await pg.evaluate("window.scrollTo(0,document.body.scrollHeight)"); await pg.wait_for_timeout(900)
        print("rv not-in count after scroll:",await pg.evaluate("document.querySelectorAll('.rv:not(.in)').length"))
        print("ERRORS",errs)
        await b.close()
asyncio.run(main())
