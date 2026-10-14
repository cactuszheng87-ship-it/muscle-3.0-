"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Tab = "home" | "plan" | "nutrition" | "progress" | "share";
type Goal = "Lean muscle" | "General fitness" | "Fat loss";
type ActivityKind = "Moderate cardio" | "Vigorous cardio" | "Strength training";
type Food = { id: string; name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number };
type Meal = { date: string; foods: Food[]; score: number };
type Activity = { id: string; date: string; name: string; minutes: number; kind: ActivityKind };
type Profile = { age: string; height: string; weight: string; goal: Goal; level: string; days: number; place: string; activity: string };
type ShareComment = { id: string; author: string; text: string; date: string };
type SharePost = { id: string; date: string; author: string; caption: string; image: string | null; likes: number; likedByMe: boolean; comments: ShareComment[] };
type SavedState = { profile: Profile; profileSaved: boolean; sessions: string[]; activities: Activity[]; meals: Meal[]; posts: SharePost[] };
type AuthSession = { mode: "guest" | "registered"; name: string; email?: string };
const KEY = "fitlife-ai-v1";
const AUTH_KEY = "fitlife-auth-v1";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const blankProfile: Profile = { age: "", height: "", weight: "", goal: "Lean muscle", level: "Beginner", days: 3, place: "Gym access", activity: "Lightly active" };
const blankState: SavedState = { profile: blankProfile, profileSaved: false, sessions: [], activities: [], meals: [], posts: [] };
// Nutrition figures are editable estimates per 100 g, used only for demo calculations.
const seedFoods: Food[] = [
  { id:"chicken", name:"烤鸡胸肉", grams:150, kcal:165, protein:31, carbs:0, fat:3.6 },
  { id:"rice", name:"茉莉香米饭", grams:180, kcal:130, protein:2.8, carbs:28.3, fat:0.3 },
  { id:"broccoli", name:"西兰花", grams:100, kcal:35, protein:2.4, carbs:7.2, fat:0.4 },
];
const nav: { id:Tab;label:string;icon:string }[] = [
  {id:"home",label:"Begin",icon:"⌂"},{id:"plan",label:"My 计划",icon:"↗"},{id:"nutrition",label:"Recording nutrition",icon:"◒"},{id:"progress",label:"My progress",icon:"✦"},{id:"share",label:"Share my upgrade",icon:"◎"},
];
const activityFactors: Record<string,number> = { "Mostly sitting":1.2,"Lightly active":1.375,"Moderately active":1.55,"Very active":1.725 };
const goalLabels: Record<Goal,string> = { "Lean muscle":"薄肌", "General fitness":"综合健身", "Fat loss":"日常减脂" };
const levelLabels: Record<string,string> = { Beginner:"初学者", "Some experience":"爱好者", Advanced:"专业人士" };
const placeLabels: Record<string,string> = { "Gym access":"健身房", "Home equipment":"家庭器械", "Bodyweight only":"无" };
const activityLabels: Record<string,string> = { "Mostly sitting":"久坐为主", "Lightly active":"轻度活动", "Moderately active":"中等活动", "Very active":"高强度活动" };
const activityKindLabels: Record<ActivityKind,string> = { "Moderate cardio":"中等强度有氧", "Vigorous cardio":"高强度有氧", "Strength training":"力量训练" };

function estimate(profile: Profile) {
  const age=Number(profile.age),height=Number(profile.height),weight=Number(profile.weight),factor=activityFactors[profile.activity]??1.375;
  if (!(age>0&&height>0&&weight>0)) return null;
  // Show a range because the Mifflin–St Jeor equation has sex-specific constants and is only predictive.
  const base=10*weight+6.25*height-5*age;
  const rest=[base-161,base+5].map(Math.round).sort((a,b)=>a-b);
  const maintenance=rest.map(n=>Math.round(n*factor/50)*50);
  return { rest, maintenance };
}

function mealScore(foods: Food[], totals:{kcal:number;protein:number;carbs:number;fat:number}) {
  if (!foods.length || totals.kcal<=0) return 0;
  const p=totals.protein*4/totals.kcal, c=totals.carbs*4/totals.kcal, f=totals.fat*9/totals.kcal;
  const macroScore=(p>=.15&&p<=.35?15:7)+(c>=.25&&c<=.60?13:6)+(f>=.15&&f<=.40?12:6);
  const hasPlant=foods.some(x=>/broccoli|vegetable|spinach|salad|tomato|fruit|apple|berry|greens|carrot|西兰花|蔬菜|菠菜|沙拉|番茄|水果|苹果|胡萝卜/i.test(x.name));
  const variety=Math.min(foods.length,3)*5;
  const portion=totals.kcal>=250&&totals.kcal<=750?15:8;
  const protein=totals.protein>=20?15:Math.round(Math.min(15,totals.protein/20*15));
  return Math.min(100,macroScore+variety+(hasPlant?15:5)+portion+protein);
}

export default function BojiApp() {
  const [tab,setTab]=useState<Tab>("home");
  const [auth,setAuth]=useState<AuthSession|null>(null);
  const [authReady,setAuthReady]=useState(false);
  const [data,setData]=useState<SavedState>(blankState);
  const [hydrated,setHydrated]=useState(false);
  const [foods,setFoods]=useState<Food[]>(seedFoods);
  const [uploaded,setUploaded]=useState<string|null>(null);
  const [scanned,setScanned]=useState(false);
  const [notice,setNotice]=useState("");
  const [activityName,setActivityName]=useState("快走");
  const [activityMinutes,setActivityMinutes]=useState(30);
  const [activityKind,setActivityKind]=useState<ActivityKind>("Moderate cardio");
  const [shareCaption,setShareCaption]=useState("");
  const [shareImage,setShareImage]=useState<string|null>(null);

  useEffect(()=>{
    try {
      const savedAuth=localStorage.getItem(AUTH_KEY);
      if(savedAuth)setAuth(JSON.parse(savedAuth) as AuthSession);
      const raw=localStorage.getItem(KEY);
      if(raw){
        const parsed=JSON.parse(raw);
        const restored:SavedState={...blankState,...parsed,profile:{...blankProfile,...parsed.profile},activities:parsed.activities??[],posts:parsed.posts??[]};
        setData(restored);
        const meal=restored.meals.find((m:Meal)=>m.date===today());
        if(meal)setFoods(meal.foods);
      }
    } catch { setNotice("Saved data could not be read; a fresh session is ready."); }
    setHydrated(true);
    setAuthReady(true);
  },[]);
  useEffect(()=>{if(!hydrated)return;try{localStorage.setItem(KEY,JSON.stringify(data));}catch{setNotice("本地存储空间不足，请删除较大的分享照片后再试。" );}},[data,hydrated]);
  useEffect(()=>()=>{if(uploaded)URL.revokeObjectURL(uploaded);},[uploaded]);

  const totals=useMemo(()=>foods.reduce((sum,f)=>({kcal:sum.kcal+f.kcal*f.grams/100,protein:sum.protein+f.protein*f.grams/100,carbs:sum.carbs+f.carbs*f.grams/100,fat:sum.fat+f.fat*f.grams/100}),{kcal:0,protein:0,carbs:0,fat:0}),[foods]);
  const score=useMemo(()=>mealScore(foods,totals),[foods,totals]);
  const todaysMeal=data.meals.find(m=>m.date===today());
  const dateLabel=new Intl.DateTimeFormat("zh-SG",{weekday:"long",month:"long",day:"numeric"}).format(new Date());
  const weekAgo=Date.now()-7*86400000;
  const weekActivities=data.activities.filter(a=>new Date(`${a.date}T00:00:00`).getTime()>=weekAgo);
  const weeklyMinutes=weekActivities.reduce((n,a)=>n+a.minutes*(a.kind==="Vigorous cardio"?2:a.kind==="Moderate cardio"?1:0),0);
  const strengthDays=new Set(weekActivities.filter(a=>a.kind==="Strength training").map(a=>a.date)).size;
  const activityScore=Math.min(100,Math.round(Math.min(70,weeklyMinutes/150*70)+Math.min(30,strengthDays/2*30)));
  const workoutsThisWeek=data.sessions.filter(d=>new Date(`${d}T00:00:00`).getTime()>=weekAgo).length;

  function chooseImage(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return;
    if(!file.type.startsWith("image/")){setNotice("请选择图片文件。" );return;}
    if(file.size>12*1024*1024){setNotice("图片需要小于 12 MB。" );return;}
    if(uploaded)URL.revokeObjectURL(uploaded);
    setUploaded(URL.createObjectURL(file));setScanned(false);setNotice("");
  }
  function chooseShareImage(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return;
    if(!file.type.startsWith("image/")){setNotice("请选择图片文件。" );return;}
    if(file.size>12*1024*1024){setNotice("图片需要小于 12 MB。" );return;}
    const reader=new FileReader();
    reader.onload=()=>{
      if(typeof reader.result!=="string")return;
      const img=new Image();
      img.onload=()=>{
        const max=1280,scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
        const ctx=canvas.getContext("2d");
        if(ctx){ctx.drawImage(img,0,0,canvas.width,canvas.height);setShareImage(canvas.toDataURL("image/jpeg",.82));}
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
    setNotice("正在处理照片，可以同时添加文字。" );
  }
  function publishSharePost(){
    const caption=shareCaption.trim();
    if(!shareImage){setNotice("请先选择一张健身照片，再发布到分享社区。" );return;}
    const post:SharePost={id:crypto.randomUUID(),date:today(),author:auth?.name||"游客",caption,image:shareImage,likes:0,likedByMe:false,comments:[]};
    setData(d=>({...d,posts:[post,...d.posts]}));
    setShareCaption("");setShareImage(null);setNotice("动态已发布到薄肌3.0分享社区。" );
  }
  function togglePostLike(id:string){
    setData(d=>({...d,posts:d.posts.map(post=>post.id===id?{...post,likedByMe:!post.likedByMe,likes:post.likes+(post.likedByMe?-1:1)}:post)}));
  }
  function addPostComment(postId:string,text:string){
    const clean=text.trim(); if(!clean){setNotice("请输入评论内容。" );return;}
    const comment:ShareComment={id:crypto.randomUUID(),author:auth?.name||"游客",text:clean,date:today()};
    setData(d=>({...d,posts:d.posts.map(post=>post.id===postId?{...post,comments:[...post.comments,comment]}:post)}));
  }
  function saveMeal(){
    const meal={date:today(),foods:foods.map(f=>({...f})),score};
    setData(d=>({...d,meals:[...d.meals.filter(m=>m.date!==today()),meal]}));setNotice("饮食、热量估算和分数已保存在此设备。" );
  }
  function updateFood(id:string,patch:Partial<Food>){setFoods(fs=>fs.map(f=>f.id===id?{...f,...patch}:f));}
  function addFood(){setFoods(fs=>[...fs,{id:crypto.randomUUID(),name:"新食物",grams:100,kcal:100,protein:5,carbs:12,fat:3}]);}
  function createPlan(){
    const p=data.profile;
    if(!(Number(p.age)>=18&&Number(p.age)<=80&&Number(p.height)>=120&&Number(p.height)<=230&&Number(p.weight)>=35&&Number(p.weight)<=250)){setNotice("请输入有效的年龄（18–80 岁）、身高（120–230 厘米）和体重（35–250 千克）。" );return;}
    setData(d=>({...d,profileSaved:true}));setNotice("你的个人计划已生成，请查看估算并按自身情况调整。" );
  }
  function logWorkout(){
    if(data.sessions.includes(today())){setNotice("今天已经记录过训练。" );return;}
    setData(d=>({...d,sessions:[...d.sessions,today()]}));setNotice("训练已记录。" );
  }
  function saveActivity(){
    if(activityMinutes<1||activityMinutes>600){setNotice("运动时间需要在 1 到 600 分钟之间。" );return;}
    const activity:Activity={id:crypto.randomUUID(),date:today(),name:activityName.trim()||activityKind,minutes:activityMinutes,kind:activityKind};
    setData(d=>({...d,activities:[...d.activities,activity],sessions:activityKind==="Strength training"&&!d.sessions.includes(today())?[...d.sessions,today()]:d.sessions}));
    setNotice("运动已加入本周分数。" );
  }
  async function shareProgress(){
    const text=`薄肌3.0本周运动分数为 ${activityScore}/100. ${weeklyMinutes} 分钟中等强度折算运动， ${strengthDays} 天力量训练。 #薄肌3.0`;
    try {
      const blob=await makeShareCard(activityScore,weeklyMinutes,strengthDays,text);
      const file=new File([blob],"薄肌3.0-运动进度.png",{type:"image/png"});
      if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:"薄肌3.0运动进度",text,files:[file]});setNotice("进度图片和文字已分享。" );return;}
      const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=file.name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
      try { if(navigator.clipboard){await navigator.clipboard.writeText(text);setNotice("进度图片已下载，分享文字已复制。" );}else setNotice("进度图片已下载。分享文字："+text); }
      catch { setNotice("进度图片已下载。分享文字："+text); }
    } catch(e){if(e instanceof Error&&e.name!=="AbortError")setNotice("此浏览器无法生成分享卡片。" );}
  }
  function resetLocalData(){if(!window.confirm("确定清除保存在此浏览器中的计划、饮食、运动和分享动态吗？"))return;setData(blankState);setFoods(seedFoods.map(f=>({...f})));setScanned(false);setNotice("本地薄肌3.0数据已清除。" );}
  function enterGuest(){const session:AuthSession={mode:"guest",name:"Guest"};localStorage.setItem(AUTH_KEY,JSON.stringify(session));setAuth(session);}
  function register(name:string,email:string){const session:AuthSession={mode:"registered",name:name.trim(),email:email.trim()};localStorage.setItem(AUTH_KEY,JSON.stringify(session));setAuth(session);setNotice("本地演示账户已创建。数据只保存在此浏览器。");}
  function logout(){localStorage.removeItem(AUTH_KEY);setAuth(null);setTab("home");}

  if(!authReady)return <div className="grid min-h-screen place-items-center bg-sea text-white"><div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-aqua text-2xl font-black text-sea">F</span><p className="mt-4 text-sm font-semibold">薄肌3.0正在准备中…</p></div></div>;
  if(!auth)return <LoginLanding onGuest={enterGuest} onRegister={register}/>;

  return <main className="min-h-screen bg-cloud grid-bg"><div className="mx-auto flex min-h-screen max-w-[1440px]">
    <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white p-6 lg:flex"><button onClick={()=>setTab("home")} className="mb-12 flex items-center gap-2 text-left text-xl font-black"><span className="grid h-9 w-9 place-items-center rounded-full bg-sea text-white">F</span> 薄肌3.0</button><NavButtons tab={tab} setTab={setTab}/><div className="mt-auto rounded-3xl bg-sea p-5 text-white"><p className="text-xs font-bold uppercase tracking-widest text-aqua">本周运动</p><p className="mt-2 text-2xl font-black">{activityScore}<span className="text-sm"> / 100</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-aqua" style={{width:`${activityScore}%`}}/></div><p className="mt-2 text-xs text-white/70">根据已记录的运动计算</p></div></aside>
    <div className="min-w-0 flex-1 p-4 pb-24 sm:p-7 sm:pb-24 lg:p-10"><header className="mb-8 flex items-center justify-between"><div><p className="text-sm font-semibold text-sea">{dateLabel}</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{tab==="home"?`hi，${auth.name}`:nav.find(n=>n.id===tab)?.label}</h1></div><div className="flex items-center gap-3"><button onClick={logout} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:text-sea">退出</button><div className="grid h-11 w-11 place-items-center rounded-full bg-aqua/30 text-sm font-bold text-sea">{auth.name.slice(0,1).toUpperCase()}</div></div></header>
      {notice&&<div role="status" className="mb-5 flex items-center justify-between rounded-2xl bg-ice px-4 py-3 text-sm text-sea"><span>{notice}</span><button aria-label="关闭提示" onClick={()=>setNotice("")} className="grid h-7 w-7 place-items-center rounded-full bg-white">×</button></div>}
      {tab==="home"&&<Overview go={setTab} data={data} activityScore={activityScore} weeklyMinutes={weeklyMinutes} meal={todaysMeal} logWorkout={logWorkout}/>} 
      {tab==="plan"&&<Plan data={data} setData={setData} create={createPlan} estimate={estimate(data.profile)}/>}
      {tab==="nutrition"&&<Nutrition uploaded={uploaded} scanned={scanned} chooseImage={chooseImage} scan={()=>{setScanned(true);setFoods(seedFoods.map(f=>({...f})));setNotice("演示识别已载入示例食物，请保存前检查每一项。" );}} foods={foods} updateFood={updateFood} removeFood={id=>setFoods(fs=>fs.filter(f=>f.id!==id))} addFood={addFood} totals={totals} score={score} saved={Boolean(todaysMeal)} save={saveMeal}/>}
      {tab==="progress"&&<Progress sessions={data.sessions} activities={data.activities} weeklyMinutes={weeklyMinutes} strengthDays={strengthDays} activityScore={activityScore} activityName={activityName} setActivityName={setActivityName} activityMinutes={activityMinutes} setActivityMinutes={setActivityMinutes} activityKind={activityKind} setActivityKind={setActivityKind} saveActivity={saveActivity} share={shareProgress} reset={resetLocalData}/>}
      {tab==="share"&&<ShareCommunity posts={data.posts} author={auth.name} image={shareImage} caption={shareCaption} setCaption={setShareCaption} chooseImage={chooseShareImage} publish={publishSharePost} like={togglePostLike} comment={addPostComment}/>} 
    </div>
  </div><nav aria-label="主导航" className="fixed bottom-0 left-0 right-0 z-10 flex justify-around border-t border-slate-200 bg-white px-2 py-2 lg:hidden"><NavButtons tab={tab} setTab={setTab} compact/></nav></main>;
}
//登陆页面
function LoginLanding({onGuest,onRegister}:{onGuest:()=>void;onRegister:(name:string,email:string)=>void}){
  const [registering,setRegistering]=useState(false);
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(name.trim().length<2){setError("请输入至少 2 个字符的名字。");return;}
    if(!/^\S+@\S+\.\S+$/.test(email)){setError("请输入有效的邮箱地址。");return;}
    if(password.length<6){setError("密码至少需要 6 个字符。");return;}
    onRegister(name,email);
  }
  return <main className="relative min-h-screen overflow-hidden bg-[#075A78] px-5 py-8 text-white sm:px-8">
    <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#39B5BE]/30 blur-2xl"/><div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-[#0D7894]/70 blur-3xl"/>
    <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between">
      <header className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#9BE7DF] text-xl font-black text-[#075A78]">F</span><span className="text-xl font-black tracking-tight">薄肌3.0</span></div><span className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold text-white/75">健康空间</span></header>
      <div className="grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
        <section><p className="text-sm font-bold uppercase tracking-[.2em] text-[#9BE7DF]">Move in the moment </p><h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.08] sm:text-6xl">让每次运动<br/>探索独属自己“地球 Online”</h1><div className="mt-9 space-y-4 text-lg leading-8 text-white/85"><blockquote className="border-l-2 border-[#9BE7DF] pl-4">“FOR 年轻人,什么是版本答案？---薄肌”</blockquote><blockquote className="border-l-2 border-white/35 pl-4 text-white/70">“薄肌 是在地球online travel 中少数可以依靠你自己实现的”</blockquote><blockquote className="border-l-2 border-white/35 pl-4 text-white/70">“薄肌小子是国家的战略部署资源。--Alan”</blockquote></div></section>
        <section className="rounded-[2rem] bg-white p-6 text-ink shadow-2xl sm:p-8">{!registering?<><p className="text-xs font-bold uppercase tracking-[.18em] text-sea">Welcome to 薄肌-俱乐部 </p><h2 className="mt-3 text-2xl font-black">Begin 你的健康记录</h2><p className="mt-2 text-sm leading-6 text-slate-500">选择注册账户，或以游客身份体验。</p><div className="mt-7 space-y-3"><button onClick={()=>{setRegistering(true);setError("");}} className="w-full rounded-full bg-sea px-5 py-3.5 text-sm font-bold text-white">注册账户</button><button onClick={onGuest} className="w-full rounded-full border border-sea/25 bg-ice px-5 py-3.5 text-sm font-bold text-sea">游客进入</button></div><p className="mt-5 text-center text-xs leading-5 text-slate-400">当前版本为本地演示。</p></>:<><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-sea">创建本地账户</p><h2 className="mt-2 text-2xl font-black">Hi,薄肌小子 </h2></div><button onClick={()=>setRegistering(false)} className="grid h-9 w-9 place-items-center rounded-full bg-ice text-sea" aria-label="返回登录选择">×</button></div><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold text-slate-600">My “地球online” name <input value={name} onChange={e=>setName(e.target.value)} placeholder="Example: Cactus Zheng" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sea"/></label><label className="block text-sm font-bold text-slate-600">邮箱地址<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sea"/></label><label className="block text-sm font-bold text-slate-600">Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 6 个字符" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sea"/></label>{error&&<p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<button type="submit" className="w-full rounded-full bg-sea px-5 py-3.5 text-sm font-bold text-white">开始 地球 online travel</button></form><p className="mt-4 text-xs leading-5 text-slate-400">仅用于本地演示</p></>}</section>
      </div>
      <footer className="text-xs text-white/55">薄肌·让进步保持在同一个节奏里。</footer>
    </div>
  </main>;
}

function NavButtons({tab,setTab,compact=false}:{tab:Tab;setTab:(t:Tab)=>void;compact?:boolean}){
  return <nav className={compact?"contents":"space-y-2"}>{nav.map(item=><button key={item.id} onClick={()=>setTab(item.id)} aria-current={tab===item.id?"page":undefined} className={compact?`flex flex-col items-center gap-1 rounded-2xl px-2 py-1 text-[10px] font-bold ${tab===item.id?"text-sea":"text-slate-400"}`:`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${tab===item.id?"bg-ice text-sea":"text-slate-500 hover:bg-slate-50"}`}><span className={`grid place-items-center rounded-full ${compact?"h-8 w-8 text-base":"h-9 w-9 text-lg"} ${tab===item.id?"bg-aqua/30 text-sea":"bg-slate-100 text-slate-500"}`}>{item.icon}</span>{compact?item.label.split(" ")[0]:item.label}</button>)}</nav>;
}

function Overview({go,data,activityScore,weeklyMinutes,meal,logWorkout}:{go:(t:Tab)=>void;data:SavedState;activityScore:number;weeklyMinutes:number;meal?:Meal;logWorkout:()=>void}){
  return <div className="space-y-6"><section className="overflow-hidden rounded-[2rem] bg-sea p-7 text-white shadow-soft sm:p-9"><div className="max-w-xl"><p className="text-sm font-bold uppercase tracking-[.18em] text-aqua">今天的运动节奏</p><h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">理想的薄肌在日复一日的发力中</h2><p className="mt-4 text-sm leading-6 text-white/75">个性化计划、饮食估算和清晰可见的运动进步。</p><div className="mt-7 flex flex-wrap gap-3"><button onClick={()=>go("progress")} className="rounded-full bg-aqua px-5 py-3 text-sm font-bold text-sea">记录运动</button><button onClick={logWorkout} className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white">记录训练</button></div></div></section>
    <section className="flex flex-col justify-between gap-4 rounded-3xl bg-ice p-6 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-sea">我的计划</p><p className="mt-1 text-sm text-slate-600">{data.profileSaved?`${goalLabels[data.profile.goal]} · 每周 ${data.profile.days} 天`:"填写资料，生成个人训练计划"}</p></div><button onClick={()=>go("plan")} className="shrink-0 rounded-full bg-sea px-5 py-3 text-sm font-bold text-white">{data.profileSaved?"查看计划":"设置我的计划"}</button></section>
    <div className="grid gap-5 xl:grid-cols-3"><section className="rounded-3xl bg-white p-6 shadow-soft xl:col-span-2"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-sea">本周运动</p><h2 className="mt-1 text-xl font-black">运动分数</h2></div><span className="grid h-14 w-14 place-items-center rounded-full bg-ice font-black text-sea">{activityScore}</span></div><p className="mt-2 text-sm text-slate-500">已记录 {weeklyMinutes} 分钟中等强度折算运动</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-aqua" style={{width:`${activityScore}%`}}/></div><button onClick={()=>go("progress")} className="mt-4 font-bold text-sea">查看运动详情 →</button></section><section className="rounded-3xl bg-white p-6 shadow-soft"><p className="text-sm font-bold text-sea">今日饮食分数</p><div className="mt-4 flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-full bg-ice text-xl font-black text-sea">{meal?.score??"—"}</span><span className="text-sm text-slate-500">{meal?`${Math.round(meal.foods.reduce((n,f)=>n+f.kcal*f.grams/100,0))} 千卡已记录`:"还没有保存饮食"}</span></div><button onClick={()=>go("nutrition")} className="mt-4 font-bold text-sea">打开营养记录 →</button></section></div>
    <section className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-soft sm:p-8"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center"><div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ice text-2xl text-sea">◎</span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-sea">薄肌3.0分享社区</p><h2 className="mt-2 text-2xl font-black text-ink">发布你的健身照片和想法</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">上传训练照片，写下今天的感受，与薄肌3.0用户互相鼓励。</p></div></div><button onClick={()=>go("share")} className="shrink-0 rounded-full bg-sea px-5 py-3.5 text-sm font-bold text-white">去分享社区</button></div><div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-sea"><span className="rounded-full bg-ice px-3 py-2">照片 + 文字</span><span className="rounded-full bg-ice px-3 py-2">点赞和评论</span><span className="rounded-full bg-ice px-3 py-2">本地互动演示</span></div></section>
  </div>;
}

function ShareCommunity({posts,author,image,caption,setCaption,chooseImage,publish,like,comment}:{posts:SharePost[];author:string;image:string|null;caption:string;setCaption:(value:string)=>void;chooseImage:(event:ChangeEvent<HTMLInputElement>)=>void;publish:()=>void;like:(id:string)=>void;comment:(id:string,text:string)=>void}){
  const [commentDrafts,setCommentDrafts]=useState<Record<string,string>>({});
  function submitComment(id:string){
    const text=commentDrafts[id]||"";
    comment(id,text);
    if(text.trim())setCommentDrafts(drafts=>({...drafts,[id]:""}));
  }
  return <div className="space-y-6 pb-5">
    <section className="rounded-[2rem] bg-sea p-6 text-white shadow-soft sm:p-8">
      <p className="text-sm font-bold uppercase tracking-[.18em] text-aqua">薄肌3.0分享社区</p>
      <h2 className="mt-3 text-3xl font-black">分享你的训练时刻</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">上传自己的健身照片，写下训练感受，与平台上的朋友点赞和评论。当前版本使用浏览器本地保存，适合演示互动流程。</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-white/35 bg-white/10 p-4 text-center">
          {image?<img src={image} alt="你准备分享的健身照片" className="h-56 w-full rounded-2xl object-cover"/>:<><span className="grid h-16 w-16 place-items-center rounded-full bg-aqua text-2xl text-sea">▣</span><b className="mt-3 text-sm">选择健身照片</b><span className="mt-1 text-xs text-white/65">支持 JPG、PNG 等图片，最大 12 MB</span></>}
          <input type="file" accept="image/*" capture="environment" onChange={chooseImage} className="sr-only"/>
        </label>
        <div className="flex flex-col">
          <label className="text-sm font-bold text-white">分享文字<textarea value={caption} onChange={e=>setCaption(e.target.value)} maxLength={280} placeholder="例如：今天完成了 40 分钟力量训练，感觉比上周更稳定！" className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-aqua"/></label>
          <div className="mt-auto flex items-center justify-between gap-3 pt-4"><span className="text-xs text-white/60">{caption.length}/280 字</span><button onClick={publish} className="rounded-full bg-aqua px-6 py-3 text-sm font-bold text-sea">发布到分享社区</button></div>
        </div>
      </div>
    </section>
    <section className="rounded-3xl bg-white p-6 shadow-soft sm:p-8">
      <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold text-sea">社区动态</p><h2 className="mt-1 text-2xl font-black">看看大家的训练记录</h2></div><span className="rounded-full bg-ice px-3 py-2 text-xs font-bold text-sea">{posts.length} 条动态</span></div>
      {posts.length===0?<div className="mt-6 rounded-2xl bg-ice p-6 text-center text-sm leading-6 text-slate-500">这里还没有动态。发布第一张健身照片，开始和薄肌3.0用户互动吧。</div>:<div className="mt-6 space-y-5">{posts.map(post=><article key={post.id} className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50">
        {post.image&&<img src={post.image} alt={`${post.author} 分享的健身照片`} className="max-h-[32rem] w-full object-cover"/>}
        <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-ink">{post.author}</p><time className="text-xs text-slate-400">{post.date}</time></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sea">薄肌3.0动态</span></div>
        {post.caption&&<p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.caption}</p>}
        <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4"><button onClick={()=>like(post.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${post.likedByMe?"bg-sea text-white":"bg-white text-sea"}`}>{post.likedByMe?"♥ 已点赞":"♡ 点赞"} · {post.likes}</button><span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-500">评论 {post.comments.length}</span></div>
        <div className="mt-4 space-y-2">{post.comments.map(item=><div key={item.id} className="rounded-2xl bg-white px-4 py-3"><p className="text-xs font-bold text-sea">{item.author} <span className="ml-2 font-normal text-slate-400">{item.date}</span></p><p className="mt-1 text-sm text-slate-600">{item.text}</p></div>)}</div>
        <div className="mt-3 flex gap-2"><input value={commentDrafts[post.id]||""} onChange={e=>setCommentDrafts(drafts=>({...drafts,[post.id]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter")submitComment(post.id)}} placeholder="写一句鼓励的话…" className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sea"/><button onClick={()=>submitComment(post.id)} className="rounded-full bg-sea px-4 py-2.5 text-sm font-bold text-white">评论</button></div>
        </div>
      </article>)}</div>}
    </section>
  </div>;
}


function Plan({data,setData,create,estimate:est}:{data:SavedState;setData:React.Dispatch<React.SetStateAction<SavedState>>;create:()=>void;estimate:ReturnType<typeof estimate>}){
  const p=data.profile;const update=(patch:Partial<Profile>)=>setData(d=>({...d,profile:{...d.profile,...patch},profileSaved:false}));
  const days=Array.from({length:p.days},(_,i)=>i+1);
  const gym=p.place==="Bodyweight only"?"深蹲 · 俯卧撑 · 臀桥":p.place==="Home equipment"?"高脚杯深蹲 · 哑铃推举 · 划船":"深蹲 · 卧推 · 绳索划船";
  const exercises=p.goal==="General fitness"?[gym,"髋部铰链 · 头顶推举 · 搬运"]:p.goal==="Fat loss"?[gym,"全身循环训练 · 轻松有氧"]:[gym,"罗马尼亚硬拉 · 推举 · 高位下拉"];
  return <div className="grid gap-6 pb-5 xl:grid-cols-[.9fr_1.1fr]"><section className="rounded-3xl bg-white p-6 shadow-soft"><p className="text-sm font-bold uppercase tracking-widest text-sea">01 · 个人资料</p><h2 className="mt-2 text-2xl font-black">先填写你的资料</h2><p className="mt-2 text-sm leading-6 text-slate-500">资料只保存在此浏览器。以下估算是一般参考，不是医疗建议。</p><div className="mt-6 grid grid-cols-2 gap-3">{([["年龄","age","岁"],["身高","height","厘米"],["体重","weight","千克"]] as const).map(([label,key,unit])=><label key={key} className="text-sm font-bold text-slate-600">{label}<div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-3"><input type="number" min="1" value={p[key]} onChange={e=>update({[key]:e.target.value})} className="w-full bg-transparent py-3 outline-none" aria-label={label}/><span className="text-xs text-slate-400">{unit}</span></div></label>)}</div><label className="mt-4 block text-sm font-bold text-slate-600">主要目标<select value={p.goal} onChange={e=>update({goal:e.target.value as Goal})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">{["Lean muscle","General fitness","Fat loss"].map(x=><option key={x}>{goalLabels[x as Goal]}</option>)}</select></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-bold text-slate-600">训练经验<select value={p.level} onChange={e=>update({level:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">{["Beginner","Some experience","Advanced"].map(x=><option key={x}>{levelLabels[x]??x}</option>)}</select></label><label className="text-sm font-bold text-slate-600">每周训练天数<select value={p.days} onChange={e=>update({days:Number(e.target.value)})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">{[2,3,4,5].map(x=><option key={x} value={x}>{x} days</option>)}</select></label></div><label className="mt-4 block text-sm font-bold text-slate-600">训练场地<select value={p.place} onChange={e=>update({place:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">{["Gym access","Home equipment","Bodyweight only"].map(x=><option key={x}>{placeLabels[x]??x}</option>)}</select></label><label className="mt-4 block text-sm font-bold text-slate-600">日常活动量<select value={p.activity} onChange={e=>update({activity:e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">{Object.keys(activityFactors).map(x=><option key={x}>{activityLabels[x]??x}</option>)}</select></label><button onClick={create} className="mt-6 w-full rounded-full bg-sea px-5 py-3.5 text-sm font-bold text-white">生成我的个人计划</button></section>
    <section className="rounded-3xl bg-sea p-6 text-white shadow-soft sm:p-8"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-aqua">✦</span><div><p className="text-sm font-bold uppercase tracking-widest text-aqua">个人训练计划</p><h2 className="mt-1 text-2xl font-black">{data.profileSaved?`${goalLabels[p.goal]} · ${levelLabels[p.level]}`:"计划预览"}</h2></div></div>{data.profileSaved&&est?<><p className="mt-4 text-sm leading-6 text-white/75">计划参考了年龄、身体数据、目标、经验、训练安排、器械和日常活动量。请按自己的感受调整动作和强度。</p><div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold uppercase tracking-wider text-aqua">每日能量估算范围</p><p className="mt-2 text-2xl font-black">{Math.min(...est.maintenance).toLocaleString()}–{Math.max(...est.maintenance).toLocaleString()} 千卡</p><p className="mt-1 text-xs text-white/65">这是根据预测公式得出的日常维持能量范围，不是必须执行的摄入目标。 <a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">公式参考</a></p></div><div className="mt-5 space-y-3">{days.map((day,i)=><div key={day} className="flex items-center gap-4 rounded-2xl bg-white/10 p-4"><span className="grid h-9 w-9 place-items-center rounded-full bg-aqua text-sea text-xs font-black">{day}</span><div><p className="text-xs font-bold text-aqua">力量训练 {day}</p><p className="font-bold">{p.days<=3?"全身力量训练":i%2===0?"上肢力量训练":"下肢力量训练"}</p><p className="text-xs text-white/70">{exercises[Math.floor(i/2)%exercises.length]} · {p.level==="Beginner"?"2–3":"3"}组，保持舒适的训练强度</p></div></div>)}</div><p className="mt-3 text-xs text-white/65">力量训练之间请安排休息或轻松活动。 <a className="underline" href="https://acsm.org/resistance-training-guidelines-update-2026/" target="_blank" rel="noreferrer">ACSM 抗阻训练参考</a></p></>:<div className="mt-8 rounded-2xl bg-white/10 p-5"><p className="font-bold">完成资料后，这里会显示你的计划。</p><p className="mt-2 text-sm leading-6 text-white/70">训练安排会根据目标、经验、每周时间和器械调整。能量只是范围，因为预测公式无法直接测量你的代谢。</p></div>}<p className="mt-5 text-xs leading-5 text-white/60">计划参考一般抗阻训练原则。本演示不能替代专业教练或医疗建议。如有伤病、健康问题或未满 18 岁，请咨询专业人士。</p></section></div>;
}

function Nutrition({uploaded,scanned,chooseImage,scan,foods,updateFood,removeFood,addFood,totals,score,saved,save}:{uploaded:string|null;scanned:boolean;chooseImage:(e:ChangeEvent<HTMLInputElement>)=>void;scan:()=>void;foods:Food[];updateFood:(id:string,p:Partial<Food>)=>void;removeFood:(id:string)=>void;addFood:()=>void;totals:{kcal:number;protein:number;carbs:number;fat:number};score:number;saved:boolean;save:()=>void}){
  const quality=score>=80?"均衡良好":score>=60?"正在改善均衡":"可以增加食物种类";
  return <div className="grid gap-6 pb-5 xl:grid-cols-[.9fr_1.1fr]"><section className="rounded-3xl bg-white p-6 shadow-soft"><p className="text-sm font-bold uppercase tracking-widest text-sea">02 · 饮食照片记录</p><h2 className="mt-2 text-2xl font-black">拍照、检查并记录</h2><p className="mt-2 text-sm leading-6 text-slate-500">照片识别目前是演示功能：会载入示例食物，不会真正分析你的照片。暂未连接真实的视觉模型或接口。</p><label className="mt-6 flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-sky-200 bg-ice p-5 text-center">{uploaded?<img src={uploaded} alt="Selected meal preview" className="h-60 w-full rounded-2xl object-cover"/>:<><span className="grid h-16 w-16 place-items-center rounded-full bg-white text-2xl text-sea">◒</span><b className="mt-3 text-sm">拍摄或选择饮食照片</b><span className="mt-1 text-xs text-slate-400">图片最大 12 MB</span></>}<input type="file" accept="image/*" capture="environment" onChange={chooseImage} className="sr-only"/></label><button onClick={scan} disabled={!uploaded} className="mt-5 w-full rounded-full bg-sea px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{scanned?"已载入演示建议":"显示演示食物建议"}</button><p className="mt-3 text-center text-xs text-slate-400">本演示不会把图片上传到服务器。</p></section>
  <section className="rounded-3xl bg-white p-6 shadow-soft"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-sea">饮食计算器</p><h2 className="mt-1 text-xl font-black">编辑食物和份量</h2></div>{scanned&&<span className="rounded-full bg-ice px-3 py-1 text-xs font-bold text-sea">演示数据</span>}</div><div className="mt-5 space-y-3">{foods.map(f=><div key={f.id} className="rounded-2xl bg-slate-50 p-3"><div className="flex items-center gap-2"><input aria-label="食物名称" value={f.name} onChange={e=>updateFood(f.id,{name:e.target.value})} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"/><label className="flex items-center rounded-xl border border-slate-200 bg-white px-1 text-xs"><input aria-label={`${f.name} 份量克数`} type="number" min="0" value={f.grams} onChange={e=>updateFood(f.id,{grams:Math.max(0,Number(e.target.value))})} className="w-14 p-2 text-right outline-none"/>克</label><button aria-label={`删除 ${f.name}`} onClick={()=>removeFood(f.id)} className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-400 hover:text-red-600">×</button></div><div className="mt-2 grid grid-cols-4 gap-2">{(["kcal","protein","carbs","fat"] as const).map(k=><label key={k} className="text-[10px] font-semibold capitalize text-slate-400">{k==="kcal"?"千卡":k==="protein"?"蛋白质":k==="carbs"?"碳水": "脂肪"} / 100 克<input type="number" min="0" aria-label={`${f.name} ${k} 每 100 克`} value={f[k]} onChange={e=>updateFood(f.id,{[k]:Math.max(0,Number(e.target.value))})} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-ink"/></label>)}</div></div>)}</div><button onClick={addFood} className="mt-3 w-full rounded-full border border-dashed border-sky-300 py-2.5 text-sm font-bold text-sea">+ 添加食物</button><div className="mt-5 rounded-3xl bg-sea p-5 text-white"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-aqua">估算热量</p><b className="mt-1 block text-3xl">{Math.round(totals.kcal).toLocaleString()} <span className="text-sm font-semibold">千卡</span></b></div><p className="text-right text-xs leading-5 text-white/75">蛋白质 {Math.round(totals.protein)} 克 · 碳水 {Math.round(totals.carbs)} 克<br/>脂肪 {Math.round(totals.fat)} 克</p></div></div><div className="mt-4 flex items-center gap-4 rounded-2xl bg-ice p-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-lg font-black text-sea">{score}</span><div><p className="font-bold text-sea">饮食均衡分数 · {quality}</p><p className="mt-1 text-xs leading-5 text-slate-500">分数根据营养比例、食物种类、植物性食物和蛋白质估算，不是医疗评估。</p></div></div><button onClick={save} className="mt-4 w-full rounded-full bg-aqua px-5 py-3.5 text-sm font-bold text-sea">{saved?"更新已保存的饮食 ✓":"保存饮食、热量和分数"}</button></section></div>;
}

function Progress({sessions,activities,weeklyMinutes,strengthDays,activityScore,activityName,setActivityName,activityMinutes,setActivityMinutes,activityKind,setActivityKind,saveActivity,share,reset}:{sessions:string[];activities:Activity[];weeklyMinutes:number;strengthDays:number;activityScore:number;activityName:string;setActivityName:(x:string)=>void;activityMinutes:number;setActivityMinutes:(x:number)=>void;activityKind:ActivityKind;setActivityKind:(x:ActivityKind)=>void;saveActivity:()=>void;share:()=>void;reset:()=>void}){
  const latest=[...activities].reverse().slice(0,8);
  return <div className="space-y-6 pb-5"><section className="rounded-3xl bg-sea p-6 text-white sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-aqua">本周运动分数</p><h2 className="mt-2 text-3xl font-black">{activityScore}<span className="text-lg text-white/70"> / 100</span></h2><p className="mt-2 text-sm text-white/75">根据本周已记录的运动计算</p></div><div className="grid h-24 w-24 place-items-center rounded-full border-8 border-aqua/70 text-2xl font-black">{activityScore}</div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-white/70">中等强度折算有氧分钟</p><b className="mt-1 block text-2xl">{weeklyMinutes} <span className="text-sm">/ 150</span></b></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-white/70">力量训练天数</p><b className="mt-1 block text-2xl">{strengthDays} <span className="text-sm">/ 2</span></b></div></div><p className="mt-4 text-xs leading-5 text-white/60">评分说明：每周有氧目标占 70 分，两天力量训练占 30 分。高强度有氧分钟数按双倍计算。参考：CDC 成人运动指南。</p></section>
  <div className="grid gap-6 xl:grid-cols-[1fr_1fr]"><section className="rounded-3xl bg-white p-6 shadow-soft"><p className="text-sm font-bold text-sea">记录一项运动</p><h2 className="mt-1 text-xl font-black">添加今天的运动</h2><label className="mt-5 block text-sm font-bold text-slate-600">运动名称<input value={activityName} onChange={e=>setActivityName(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"/></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-bold text-slate-600">分钟<input type="number" min="1" max="600" value={activityMinutes} onChange={e=>setActivityMinutes(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"/></label><label className="text-sm font-bold text-slate-600">类型<select value={activityKind} onChange={e=>setActivityKind(e.target.value as ActivityKind)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">{["Moderate cardio","Vigorous cardio","Strength training"].map(x=><option key={x}>{activityKindLabels[x as ActivityKind]}</option>)}</select></label></div><button onClick={saveActivity} className="mt-5 w-full rounded-full bg-sea px-5 py-3.5 text-sm font-bold text-white">加入运动分数</button></section><section className="rounded-3xl bg-white p-6 shadow-soft"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-sea">最近运动</p><h2 className="mt-1 text-xl font-black">你的运动记录</h2></div><span className="grid h-12 w-12 place-items-center rounded-full bg-ice text-sea">↗</span></div>{latest.length?<ul className="mt-5 max-h-72 space-y-2 overflow-auto">{latest.map(a=><li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"><div><p className="font-bold">{a.name}</p><p className="text-xs text-slate-400">{activityKindLabels[a.kind]} · {a.minutes} 分钟</p></div><time className="text-xs text-slate-500">{new Date(`${a.date}T12:00:00`).toLocaleDateString()}</time></li>)}</ul>:<p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">还没有运动记录。添加运动后即可开始计算本周分数。</p>}</section></div>
  <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]"><section className="rounded-3xl bg-white p-6 shadow-soft"><p className="text-sm font-bold text-sea">力量训练次数</p><p className="mt-2 text-3xl font-black">{sessions.length}</p><p className="mt-1 text-sm text-slate-500">已记录的训练次数。请在上方记录力量训练类型和时长，才能计入分数。</p></section><section className="rounded-3xl bg-ice p-6 shadow-soft"><p className="text-xs font-bold uppercase tracking-[.16em] text-sea">分享卡片</p><h2 className="mt-2 text-2xl font-black text-sea">图片 + 文字</h2><p className="mt-2 text-sm text-slate-600">生成包含运动分数和配套文字的可分享进度图片。</p><button onClick={share} className="mt-5 w-full rounded-full bg-sea px-5 py-3.5 text-sm font-bold text-white">生成图片和文字分享</button></section></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><p className="max-w-2xl text-xs leading-5 text-slate-400">运动分数是根据每周公共健康目标生成的激励性总结，不是医学体能评估。记录只保存在此浏览器。 <a href="https://www.cdc.gov/physical-activity-basics/guidelines/adults.html" target="_blank" rel="noreferrer" className="underline">CDC 成人运动指南</a></p><button onClick={reset} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">清除本地数据</button></div></div>;
}

function makeShareCard(score:number,minutes:number,strengthDays:number,caption:string):Promise<Blob>{
  return new Promise((resolve,reject)=>{
    const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext("2d");if(!ctx){reject(new Error("Canvas unavailable"));return;}
    const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,"#075A78");bg.addColorStop(1,"#128DA6");ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
    ctx.fillStyle="#B8F3EA";ctx.beginPath();ctx.arc(880,200,220,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#075A78";ctx.font="700 54px Arial";ctx.fillText("薄肌3.0 · 每周记录",90,130);
    ctx.fillStyle="#FFFFFF";ctx.font="900 190px Arial";ctx.fillText(String(score),90,500);ctx.font="700 56px Arial";ctx.fillText("运动分数 / 100",95,590);
    ctx.fillStyle="#DDF9F6";ctx.font="600 46px Arial";ctx.fillText(`${minutes} 运动分钟`,95,760);ctx.fillText(`${strengthDays} 力量训练天数`,95,840);
    ctx.fillStyle="#FFFFFF";ctx.font="700 42px Arial";ctx.fillText("每天进步，每周更强。",95,1130);
    ctx.fillStyle="#DDF9F6";ctx.font="32px Arial";ctx.fillText(caption.slice(0,64),95,1210);
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Image creation failed")),"image/png");
  });
}


