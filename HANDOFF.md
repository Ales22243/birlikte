# Devir notu: Birlikte, 3D çizgi film çalışması

Kullanıcı (Adem) teknik değil: her şeyi senin yapmanı, ona iş bırakmamanı istiyor. Türkçe, kısa ve dürüst konuş. Yayını da sen yaparsın.

## Proje
Adem & Sena için gün sayacı PWA (Vite + React + framer-motion + Dexie). Klasör: `C:\Users\adem_\OneDrive\Masaüstü\Birlikte` (oturumu buradan açmak daha doğru; eski "Şükürlü günler" projesine dokunma).
Yayın: GitHub Pages (`gh-pages` dalına `dist` itilir → https://ales22243.github.io/birlikte/) ve Vercel (https://birlikte-ales22243.vercel.app, `master`'a push ile otomatik). `birlikte.vercel.app` başkasının, kullanma.
Yayın komutları (her seferinde): `npm run build` → `git add -A; git commit; git push origin master` → geçici klasöre `dist` kopyala, `.nojekyll` ekle, `git init -b gh-pages`, commit, `git push -f origin gh-pages`. Commit mesajına `Co-Authored-By: Claude ...` satırı eklenir.

## Animasyon sekmesi (src/features/Anim.tsx)
İki tür: **Fotoğraflı film** (src/lib/animator.ts) ve **Çizgi film** (src/lib/cartoon.ts). İkisi de `FrameSource` arayüzüyle (duration, prepare, prefetch, draw(ctx,t), dispose) 720×1280 2D tuvale çizilir; Anim.tsx bunu canvas.captureStream + MediaRecorder ile gerçek zamanlı kaydeder (iPhone'da mp4). Müzik: src/lib/music.ts (WebAudio müzik kutusu).

## Videolarım (16 Ekim 2026)
Kullanıcı kodla çizilen karakterleri beğenmedi; yüz benzerliği için yapay zekâ videosu (Kling) üretti. Animasyon sekmesine üçüncü tür "Videolarım" eklendi: kullanıcı kendi videolarını ekler (IndexedDB `clips` tablosu, yalnızca cihazda; `src/data/clips.ts`), sıralar, `src/lib/clipfilm.ts` bunları açılış kartı + geçişli klipler + bitiş kartıyla 720x1280 dikey filme çevirir. Görünüm: "Tamamı görünsün" (bulanık arka plan, üstte isimler, altta gün) / "Ekranı doldur". Ses: videonun kendi sesi (kayıtta MediaElementSource ile), müzik kutusu, şarkılar ya da sessiz. Kullanıcının videoları ASLA depoya/yayına konmaz.
Not: Claude tarayıcı panelinde "Video oluştur" kaydı panel görünürlüğü değiştiği için hemen durur (visibilitychange); kayıt hattı konsoldan ClipFilm + MediaRecorder ile doğrulandı.

## Önceki iş: çizgi filmi gerçek 3D (Pixar tarzı) yapmak
İstek: referans = `Yeni klasör (6)` içindeki ekran görüntüsü (3D CGI, sıcak altın ışık, bokeh, kenar ışığı). Karakter yüzleri: `Yeni klasör (5)` içinde kalan tek fotoğraf (arabada selfie): Adem = yuvarlak dolgun yüz, geniş alın, M saç çizgisi (şakaklar geride), kısa koyu kahve saç, kalın düz koyu kaşlar, açık kahve-yeşilimsi göz, kısa kirli sakal, pembe yanaklar, açık gri uzun kollu tişört + koyu kot (fotoğraftaki gibi; 3D'de güncellendi), dolgun koyu sakal. Sena = oval yüz, ortadan ayrık, omuzdan uzun düz saç (bal sarısı; köklerde koyu, uçlarda açık), kahve gözler, çiller, altın küpe, lacivert bluz + bej etek (3D'de güncellendi).
Hikâye (mevcut 2D sürümdeki gibi, 47 sn): 1) şezlongda gün batımı (arkadan, sonra birbirine dönüp gülerler, "Yürüyelim mi?") 2) el ele yürüyüş, birbirine bakıp mutlu 3) salaş balıkçıda balık dürüm, Sena'nın burnunda sos, kahkaha, "Şerefe!" 4) kapanış. Filmvari, kesintisiz geçişler.

### Güncel durum (15 Ekim 2026, ikinci oturum): 3D BAĞLANDI ve YAYINLANDI
- `world.ts` üç sahneyi de çiziyor (`poseChairs`, `poseWalk`, `poseShack`); `cartoon.ts` `prepare()` içinde `loadWorld()` ile 3D dünyayı tembel yükler (tek WebGL bağlamı, modül düzeyinde paylaşılır) ve her sahnede `people3d()` ile bindirir. WebGL yoksa eski 2D karakterlere düşer (`chairs2d`, `walk2d`, `shack2d`).
- Konuşma balonları 3D başın ekran konumuna göre yerleşir (`Cartoon.head()` → `World.headScreen()`), kadeh parıltısı `World.clink`.
- Gülerken göz: `happy` ∩ çizgisi (göz küresi gizlenir). Gözyaşları kaldırıldı. Sena otururken etek küçülür, uyluk elbise rengine döner.
- Masaüstü ölçüm (Intel UHD): kare ~21 ms, geçişlerde ~45 ms. 47 sn MP4 kaydı denendi (23 MB) ve çalıştı. iPhone'da denenmedi.
- `src/lib/c3d/dev.ts` artık yok (silindi). Sahne ayarı için geçici olarak `window.__w3 = this.w3` ekleyip konsoldan `__w3.render(kind,t)` + kamera ile yakın plan çekmek pratik.
- Olası iyileştirmeler: eklem yerlerinde "manken" görüntüsü (kapsül uzuvlar), Adem'in pantolon rengi ten rengine yakın, iPhone'da yavaşsa `Stage` gölgeyi kapatma / pikselOranı 0.75 seçeneği.

### Eski durum (ilk oturum)
- **Çalışan, yayında olan**: 2D çizgi film (src/lib/cartoon.ts + cartoon-people.ts), kullanıcı bunun "gerçekçi/3D değil" olduğunu söyledi, bu yüzden 3D'ye geçiliyor.
- **Yeni 3D modülü (henüz uygulamaya bağlı DEĞİL, yayınlanmadı)**: `three` kuruldu. `src/lib/c3d/`:
  - `humanoid.ts` (tamam, test edildi): `Humanoid('adem'|'sena')`. Kafa (küre + çene/yanak deformasyonu, kıvrık yüzeye raycast ile yerleşen gözler/kaşlar/burun/ağız çıkartması), saç (kabuk doku + hacim kümeleri; Sena için lathe "pelerin" + yan lüleler), sakal dokusu, gövde/kıyafet, IK'li kollar-bacaklar. `update(pose: Pose3, expr: Expr, t)`. Yüz yakın planları gerçekten iyi göründü (Adem ve Sena). Ağız yüzü canvas dokusundan her karede boyanıyor.
  - `stage.ts`: şeffaf WebGL sahnesi (alpha), ışık düzeneği (`SUNSET`, `NIGHT`), PMREM ortam, gölge yakalayıcı zemin, ACES tonlama.
  - `world.ts` (YARIM): `World` sınıfı: iki karakter + şezlong/masa/balıkçı masası nesneleri + `render(kind, t)`. Sadece `poseChairs` yazıldı ve test EDİLMEDİ (işaretler/kamera ayarlanmalı). `walk` ve `shack` pozları + dürüm/bardak/yeme/kahkaha animasyonu yazılmadı.
  - `dev.ts`: SADECE geliştirme test donanımı (`testScene`), iş bitince sil.
- Tasarım kararı: arka plan 2D katmanda kalır (gökyüzü, deniz, kum, ışıklar, balonlar, altyazı: cartoon.ts), karakterler ve yakın nesneler 3D'de çizilip şeffaf tuval olarak üstüne `ctx.drawImage(world.stage.renderer.domElement, 0, 0)` ile bindirilir; sonra 2D bindirmeler (konuşma balonları, kalpler, film tanesi/vinyet). `Cartoon.prepare()` içinde `import('./c3d/world')` ile tembel yüklenmeli (paket küçük kalsın). Koordinatlar metre; karakter yüzü +z (kameraya) bakar; şezlongda -z (denize), yürürken +x.
- Pose işaretleri (head yaw yönü, kol L/R = karakterin sağı/solu, pole yönleri) deneme-yanılma ile ayarlanacak. Karakter 'L' kolu yerel -x'te (kameraya bakarken ekranın solu).

### Sıradaki adımlar
1. `world.ts`: `chairs` sahnesini ayarla (kamera, ışık, baş çevirme işaretleri, eller birleşsin). Ekran görüntüsüyle doğrula.
2. `walk` pozu (yürüme döngüsü, el ele, birbirine bakma), `shack` pozu (masa arkası, dürüm → ağız, kahkaha titremesi, şerefe, sos), Humanoid'e `mouthWorld()` yardımcı ekle (ağız konumu için).
3. `cartoon.ts`'de 3D'yi bağla: eski `drawPerson` çağrılarının yerine 3D tuvali bindir; 2D'deki sandalye/masa/kedi vb. ön plan nesnelerini 3D ile çakışmayacak şekilde kaldır/azalt. Telefonda performans için gölge haritası ve segmentleri gerekirse düşür.
4. İşiyi bitirince `dev.ts`'i sil, `npm run build`, Anim.tsx ile gerçek kayıt dene (47 sn, MP4), yayınla (yukarıdaki komutlar). Telefonda denenemediği için kullanıcıya iPhone'da kontrol ettir; WebGL bellek/performans sorunu olursa kaliteyi düşüren bir seçenek ekle.
5. Kalan eski 2D dosyalar (cartoon-people.ts) 3D bitince silinebilir.

## Geliştirme ipuçları
- Test: `npx vite --port 5199 --strictPort` (arka planda) → tarayıcıda `http://localhost:5199/`; konsolda `const m = await import('/src/lib/c3d/dev.ts'); const {st,A,S}=m.testScene(document)`; kamera `st.camera.position.set(...); st.camera.lookAt(...); st.render()`. Her dosya değişikliğinde Vite sayfayı yeniler, kurulumu yeniden çalıştır.
- Konsolda çıplak `import('three')` çalışmaz; `dev.ts` THREE'yi yeniden dışa aktarır.
- Bash aracında `python - <<'PY'` içinde ters eğik çizgi dizileri (`\r\n` gibi) bozulabilir; kritik yerlerde `chr(92)` kullan ya da Edit/Write tercih et. Git Bash'te `MSYS_NO_PATHCONV=1` (vercel api yolları için).
- TypeScript katı: `erasableSyntaxOnly` (constructor parametre özelliği yok), `noUnusedLocals`.
- Önizleme sunucuları işin sonunda kapatılır (PowerShell ile 5199/4173 portlarını dinleyen node süreci).
