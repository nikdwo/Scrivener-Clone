type Release = {version:string, notes:string, fileName:string, size:number};
export class Updates {
  private dialog = document.createElement('dialog');
  private version = '';
  private portable = false;
  private busy = false;
  private installing = false;
  private release:Release|null = null;
  private downloaded = false;
  constructor(private rpc:(action:string,args?:any)=>Promise<any>, private flush:()=>Promise<void>, saveAutomatic:(enabled:boolean)=>Promise<void>) {
    this.dialog.id='updateDialog';this.dialog.setAttribute('aria-labelledby','updateTitle');
    this.dialog.innerHTML=`<div class="dialog-header"><h2 id="updateTitle">Schreibatelier aktualisieren</h2></div><p id="updateVersion"></p><label class="form-check"><input type="checkbox" id="updateAuto"> Beim Programmstart nach Updates suchen</label><p id="updateStatus" role="status" aria-live="polite"></p><progress id="updateProgress" max="100" hidden aria-label="Update-Download"></progress><pre id="updateNotes" class="license-text" hidden></pre><p id="updateInstructions" class="muted"></p><div class="dialog-actions"><button id="updateClose">Schließen</button><button id="updateCheck">Erneut prüfen</button><button id="updateDownload" class="primary" hidden>Herunterladen</button><button id="updateInstall" class="primary" hidden>Speichern und Installer starten</button><button id="updateShow" hidden>Downloadordner öffnen</button></div>`;
    document.body.append(this.dialog);
    this.button('updateClose').onclick=()=>this.close();
    this.button('updateCheck').onclick=()=>void this.check();
    this.button('updateDownload').onclick=()=>void this.download();
    this.button('updateInstall').onclick=()=>void this.install();
    this.button('updateShow').onclick=()=>void this.rpc('updateShowFile').catch(e=>this.status(e.message));
    const automatic=this.el('updateAuto') as HTMLInputElement;
    automatic.onchange=()=>{automatic.disabled=true;void saveAutomatic(automatic.checked).catch(e=>{automatic.checked=!automatic.checked;this.status(e.message)}).finally(()=>{automatic.disabled=false})};
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close()});
  }
  private el(id:string) { return this.dialog.querySelector<HTMLElement>('#'+id)!; }
  private button(id:string) { return this.el(id) as HTMLButtonElement; }
  private status(text:string) { this.el('updateStatus').textContent=text; }
  private controls() {
    this.button('updateCheck').disabled=this.busy;
    this.button('updateDownload').hidden=!this.release||this.downloaded;
    this.button('updateDownload').disabled=this.busy;
    this.button('updateInstall').hidden=!this.downloaded||this.portable;
    this.button('updateInstall').disabled=this.busy;
    this.button('updateShow').hidden=!this.downloaded;
    this.button('updateShow').disabled=this.busy;
    this.button('updateClose').textContent=this.busy?'Abbrechen':'Schließen';
  }
  configure(info:{version:string,portable:boolean}, automatic:boolean) {
    this.version=info.version;this.portable=info.portable;
    this.el('updateVersion').textContent=`Aktuelle Version: ${info.version} · ${info.portable?'Portabel':'Windows-Anwendung'}`;
    (this.el('updateAuto') as HTMLInputElement).checked=automatic;
    this.el('updateInstructions').textContent='Updates kommen von GitHub. Es werden keine Manuskripttexte übertragen. Herunterladen und Installieren startest du selbst.';
  }
  private close() { if(this.installing)return;if(this.busy)void this.rpc('updateCancel').catch(e=>this.status(e.message));this.dialog.close(); }
  progress(percent:number) { const bar=this.el('updateProgress') as HTMLProgressElement;bar.value=percent;this.status(`Wird heruntergeladen … ${percent} %`); }
  async check(automatic=false) {
    if(this.busy){if(!automatic&&!this.dialog.open)this.dialog.showModal();return}
    this.busy=true;this.release=null;this.downloaded=false;this.controls();this.el('updateNotes').hidden=true;this.el('updateProgress').hidden=true;
    this.status('Suche nach veröffentlichten Updates …');
    if(!automatic&&!this.dialog.open)this.dialog.showModal();
    try {
      this.release=await this.rpc('updateCheck');
      if(this.release) {
        this.status(`Version ${this.release.version} ist verfügbar (${Math.ceil(this.release.size/1024/1024)} MB).`);
        this.el('updateNotes').textContent=this.release.notes;this.el('updateNotes').hidden=!this.release.notes;
        if(automatic&&!this.dialog.open)this.dialog.showModal();
      } else this.status(`Keine neuere passende Version verfügbar. Installiert: ${this.version}.`);
    } catch(e:any) { this.status(e.message); }
    finally { this.busy=false;this.controls(); }
  }
  private async download() {
    if(this.busy||!this.release)return;this.busy=true;this.controls();this.el('updateProgress').hidden=false;this.progress(0);
    try {
      await this.rpc('updateDownload');this.downloaded=true;
      this.status('Download vollständig. SHA-256-Prüfung erfolgreich.');
      this.el('updateInstructions').textContent=this.portable
        ? 'Downloadordner öffnen, Schreibatelier schließen und das ZIP in den bisherigen Programmordner entpacken. Programmdateien ersetzen; den vorhandenen Ordner Data und eigene Projektdateien beibehalten. Bei einem neuen Zielordner Data bei geschlossener Anwendung mitkopieren.'
        : 'Beim Start des Installers wird dein offenes Projekt gespeichert und gesichert. Schreibatelier schließt sich anschließend. Folge den Schritten im Installer.';
    } catch(e:any) { this.status(e.message); }
    finally {this.busy=false;this.el('updateProgress').hidden=true;this.controls()}
  }
  private async install() {
    if(this.busy||!this.downloaded||this.portable)return;this.busy=true;this.installing=true;this.controls();this.button('updateClose').disabled=true;
    try { this.status('Projekt wird gespeichert und gesichert …');await this.flush();await this.rpc('updateInstall');this.status('Installer gestartet. Schreibatelier wird geschlossen.'); }
    catch(e:any) { this.status(e.message); }
    finally {this.busy=false;this.installing=false;this.controls();this.button('updateClose').disabled=false}
  }
}
