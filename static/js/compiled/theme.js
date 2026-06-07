const LIGHT_PALETTE={primary:"#d35400",secondary:"#e67e22",accent:"#f0883e",warm:"#f9e8d5",muted:"#fdf8f4",surface:"#ffffff",onPrimary:"#ffffff"};
const DARK_PALETTE={primary:"#f0883e",secondary:"#d35400",accent:"#e67e22",warm:"#1c1000",muted:"#221500",surface:"#0d0b14",onPrimary:"#0d0b14"};
const GRADIENTS=[
  {name:"--grad-hero",value:"linear-gradient(135deg, #1a0a02 0%, #3d1602 30%, #d35400 65%, #f0883e 100%)"},
  {name:"--grad-btn-primary",value:"linear-gradient(135deg, #c04a00, #d35400 50%, #e67e22)"},
  {name:"--grad-card-warm",value:"linear-gradient(145deg, #fff9f4 0%, #fff3e8 100%)"},
  {name:"--grad-navbar",value:"linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(253,248,244,0.97) 100%)"},
  {name:"--grad-badge-admin",value:"linear-gradient(135deg, #92400e, #d35400)"},
  {name:"--grad-badge-vendor",value:"linear-gradient(135deg, #1e3a5f, #2980b9)"},
  {name:"--grad-badge-client",value:"linear-gradient(135deg, #064e3b, #059669)"},
  {name:"--grad-cinta",value:"linear-gradient(135deg, #0e0010 0%, #1a0518 25%, #2a0a28 50%, #1a0518 75%, #0e0010 100%)"},
  {name:"--grad-focus-ring",value:"linear-gradient(135deg, rgba(211,84,0,0.18), rgba(240,136,62,0.08))"},
  {name:"--grad-avatar-default",value:"linear-gradient(135deg, #d35400, #f0883e)"},
];
const DARK_GRADIENTS=[
  {name:"--grad-hero",value:"linear-gradient(135deg, #090600 0%, #1a0800 30%, #8a2f00 65%, #b84000 100%)"},
  {name:"--grad-btn-primary",value:"linear-gradient(135deg, #b84000, #d35400 50%, #e67e22)"},
  {name:"--grad-card-warm",value:"linear-gradient(145deg, #1c1000 0%, #221500 100%)"},
  {name:"--grad-navbar",value:"linear-gradient(90deg, rgba(13,11,20,0.97) 0%, rgba(18,16,26,0.97) 100%)"},
  {name:"--grad-focus-ring",value:"linear-gradient(135deg, rgba(240,136,62,0.25), rgba(211,84,0,0.10))"},
  {name:"--grad-avatar-default",value:"linear-gradient(135deg, #c04a00, #d35400)"},
];

function _injectTokens(mode){
  const palette=mode==="dark"?DARK_PALETTE:LIGHT_PALETTE;
  const gradients=mode==="dark"?DARK_GRADIENTS:GRADIENTS;
  const root=document.documentElement;
  Object.entries(palette).forEach(([k,v])=>root.style.setProperty(`--brand-${k}`,v));
  const gradMap=new Map(gradients.map(g=>[g.name,g.value]));
  GRADIENTS.forEach(({name})=>{const val=gradMap.get(name);if(val)root.style.setProperty(name,val);});
}

export class ThemeManager{
  constructor(){
    this.current=this._detect();
    this.observer=new MutationObserver(()=>{
      const next=this._detect();
      if(next!==this.current){this.current=next;_injectTokens(next);}
    });
    this.observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    _injectTokens(this.current);
  }
  _detect(){return document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light";}
  get mode(){return this.current;}
}

export class AvatarFallback{
  static colorFor(name){
    const hash=name.split("").reduce((h,c)=>(h<<5)-h+c.charCodeAt(0),0);
    return AvatarFallback.PALETTES[Math.abs(hash)%AvatarFallback.PALETTES.length];
  }
  static build(name,size=40){
    const initial=(name||"?").charAt(0).toUpperCase();
    const[c1,c2]=AvatarFallback.colorFor(name);
    const fs=Math.max(10,Math.round(size*0.42));
    const el=document.createElement("div");
    el.style.cssText=[`width:${size}px`,`height:${size}px`,`background:linear-gradient(135deg, ${c1}, ${c2})`,"border-radius:50%","display:inline-flex","align-items:center","justify-content:center",`font-size:${fs}px`,"font-weight:800","color:#fff","user-select:none","flex-shrink:0","font-family:'DM Sans',system-ui,sans-serif"].join(";");
    el.textContent=initial;
    el.setAttribute("aria-label",name||"Avatar");
    return el;
  }
  static apply(imgEl,name){
    if(!imgEl?.parentNode)return;
    const size=imgEl.parentElement?.offsetWidth||40;
    const avatar=AvatarFallback.build(name,size);
    avatar.style.minWidth="100%";avatar.style.minHeight="100%";
    imgEl.parentNode.replaceChild(avatar,imgEl);
  }
}
AvatarFallback.PALETTES=[["#d35400","#f0883e"],["#1a6fa8","#2980b9"],["#1a8f4c","#27ae60"],["#6d28d9","#8b5cf6"],["#b91c1c","#ef4444"],["#0e7490","#06b6d4"],["#92400e","#d97706"]];

export class ProfileImageLoader{
  static _thumb(url,w,h){
    if(url.includes("cloudinary.com")&&url.includes("/upload/"))return url.replace("/upload/",`/upload/w_${w},h_${h},c_fill,g_auto:face,q_auto,f_auto/`);
    if(url.includes("googleusercontent.com"))return url.replace(/=s\d+-c/,`=s${Math.max(w,h)}-c`);
    return url;
  }
  static load(imgEl,rawUrl,name,size=80){
    if(!imgEl||imgEl._profileLoaded)return;
    const isDefault=!rawUrl||rawUrl.includes("default_icon_profile")||rawUrl==="/static/uploads/default_icon_profile.png";
    if(isDefault){AvatarFallback.apply(imgEl,name);return;}
    const optimized=ProfileImageLoader._thumb(rawUrl,size,size);
    imgEl.classList.add("prof-img-loading");
    const tmp=new Image();
    tmp.onload=()=>{
      if(!imgEl.parentNode)return;
      imgEl.src=optimized;imgEl._profileLoaded=true;
      imgEl.classList.remove("prof-img-loading");
      imgEl.onerror=()=>{if(imgEl.parentNode)AvatarFallback.apply(imgEl,name);};
    };
    tmp.onerror=()=>{imgEl.classList.remove("prof-img-loading");AvatarFallback.apply(imgEl,name);};
    tmp.src=optimized;
  }
  static initAll(selector="img[data-profile]"){
    document.querySelectorAll(selector).forEach(img=>{
      ProfileImageLoader.load(img,img.dataset.profile??"",img.dataset.profileName??"",parseInt(img.dataset.profileSize??"80",10));
    });
  }
}

const themeManager=new ThemeManager();
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",()=>ProfileImageLoader.initAll());}
else{ProfileImageLoader.initAll();}

window.DS_Theme=ThemeManager;
window.DS_Avatar=AvatarFallback;
window.DS_ProfileLoader=ProfileImageLoader;
window._themeManager=themeManager;
