import { Injectable, signal } from '@angular/core';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

@Injectable({
  providedIn: 'root'
})
export class SqliteService {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  public isReady = signal<boolean>(false);

  constructor() {
    this.initDb();
  }

  private async initDb() {
    try {
      this.SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });
      
      await this.loadDatabase();
      this.isReady.set(true);
      console.log('SQLite Ready');
    } catch (e) {
      console.error('Failed to init SQLite', e);
    }
  }

  private async loadDatabase() {
    const savedDb = localStorage.getItem('tcg_db');
    if (savedDb) {
      // Decode base64 to Uint8Array
      const binaryString = window.atob(savedDb);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      this.db = new this.SQL!.Database(bytes);
    } else {
      this.db = new this.SQL!.Database();
      this.createSchema();
    }
  }

  private createSchema() {
    if (!this.db) return;
    const sqlStr = `
      CREATE TABLE IF NOT EXISTS pokemon_cache (
        pokeapi_id INTEGER PRIMARY KEY,
        card_data TEXT
      );
      CREATE TABLE IF NOT EXISTS local_config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS local_decks (
        id TEXT PRIMARY KEY,
        name TEXT,
        cards TEXT
      );
      CREATE TABLE IF NOT EXISTS local_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_data TEXT,
        date TEXT,
        synced INTEGER DEFAULT 0
      );
    `;
    this.db.run(sqlStr);
    
    // Add synced column if it doesn't exist (for older local DBs)
    try {
      this.db.run("ALTER TABLE local_history ADD COLUMN synced INTEGER DEFAULT 0;");
    } catch(e) {
      // Ignore if column already exists
    }
    
    this.saveDatabase();
  }

  private saveDatabase() {
    if (!this.db) return;
    const data = this.db.export();
    // Convert Uint8Array to base64
    let binary = '';
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(data[i]);
    }
    localStorage.setItem('tcg_db', window.btoa(binary));
  }

  public cachePokemon(pokeapiId: number, cardData: any) {
    if (!this.db) return;
    const stmt = this.db.prepare("INSERT OR REPLACE INTO pokemon_cache (pokeapi_id, card_data) VALUES (?, ?)");
    stmt.run([pokeapiId, JSON.stringify(cardData)]);
    stmt.free();
    this.saveDatabase();
  }

  public getCachedPokemon(pokeapiId: number): any | null {
    if (!this.db) return null;
    const stmt = this.db.prepare("SELECT card_data FROM pokemon_cache WHERE pokeapi_id = ?");
    const result = stmt.getAsObject({1: pokeapiId});
    stmt.free();
    if (result && result['card_data']) {
      return JSON.parse(result['card_data'] as string);
    }
    return null;
  }

  public saveLocalMatchResult(matchData: any) {
    if (!this.db) return;
    const stmt = this.db.prepare("INSERT INTO local_history (match_data, date, synced) VALUES (?, ?, 0)");
    stmt.run([JSON.stringify(matchData), new Date().toISOString()]);
    stmt.free();
    this.saveDatabase();
  }

  public getLocalHistory() {
    if (!this.db) return [];
    const stmt = this.db.prepare("SELECT * FROM local_history ORDER BY id DESC");
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results.map(r => ({
      id: r['id'] as number,
      matchData: JSON.parse(r['match_data'] as string),
      date: r['date'] as string,
      synced: r['synced'] === 1
    }));
  }

  public getUnsyncedLocalHistory() {
    if (!this.db) return [];
    const stmt = this.db.prepare("SELECT * FROM local_history WHERE synced = 0");
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results.map(r => ({
      id: r['id'] as number,
      matchData: JSON.parse(r['match_data'] as string),
      date: r['date'] as string
    }));
  }

  public markHistoryAsSynced(id: number) {
    if (!this.db) return;
    const stmt = this.db.prepare("UPDATE local_history SET synced = 1 WHERE id = ?");
    stmt.run([id]);
    stmt.free();
    this.saveDatabase();
  }

  public saveLocalConfig(key: string, value: any) {
    if (!this.db) return;
    const stmt = this.db.prepare("INSERT OR REPLACE INTO local_config (key, value) VALUES (?, ?)");
    stmt.run([key, JSON.stringify(value)]);
    stmt.free();
    this.saveDatabase();
  }

  public getLocalConfig(key: string): any {
    if (!this.db) return null;
    const stmt = this.db.prepare("SELECT value FROM local_config WHERE key = ?");
    const result = stmt.getAsObject({1: key});
    stmt.free();
    if (result && result['value']) return JSON.parse(result['value'] as string);
    return null;
  }
}
