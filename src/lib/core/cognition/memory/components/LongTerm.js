// LongTerm - 长期记忆具体实现
// 基于NeDB的持久化存储，支持通过Schema中的任何Cue检索

const { LongTermMemory } = require('../interfaces/LongTermMemory.js');
const path = require('path');
const fs = require('fs-extra');
const logger = require('../../../../utils/logger');

// 临时的内存实现，等nedb安装后替换
class InMemoryDatastore {
  constructor(options) {
    this.filename = options.filename;
    this.data = new Map();
    this.indexes = new Map();
    
    // 如果有文件，尝试加载
    if (this.filename && fs.existsSync(this.filename)) {
      try {
        const content = fs.readFileSync(this.filename, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const doc = JSON.parse(line);
          this.data.set(doc._id, doc);
        });
      } catch (e) {
        // 忽略加载错误
      }
    }
  }
  
  ensureIndex(options) {
    // 简单记录索引字段
    this.indexes.set(options.fieldName, true);
  }
  
  update(query, doc, options, callback) {
    const id = query._id;
    if (options.upsert) {
      this.data.set(id, doc);
      this.persist();
    }
    callback(null);
  }
  
  find(query) {
    const self = this;
    const result = {
      sort() { return this; },
      exec(callback) {
        let docs = Array.from(self.data.values());
        
        // 简单查询实现
        if (query.cues && query.cues.$in) {
          const searchCues = query.cues.$in;
          docs = docs.filter(doc => 
            doc.cues.some(cue => searchCues.includes(cue))
          );
        }
        
        callback(null, docs);
      }
    };
    return result;
  }
  
  count(query, callback) {
    callback(null, this.data.size);
  }
  
  persist() {
    if (this.filename) {
      try {
        // 确保目录存在
        fs.ensureDirSync(path.dirname(this.filename));
        const lines = Array.from(this.data.values())
          .map(doc => JSON.stringify(doc))
          .join('\n');
        fs.writeFileSync(this.filename, lines);
      } catch (e) {
        // 忽略持久化错误，继续在内存中运行
        console.warn('Failed to persist memory:', e.message);
      }
    }
  }
  
  persistence = {
    compactDatafile: () => {}
  };
}

class LongTerm extends LongTermMemory {
  constructor(options = {}) {
    super();
    
    // 支持options参数或旧的dbPath参数
    if (typeof options === 'string') {
      options = { dbPath: options };
    }
    
    // 如果是纯内存模式，不使用文件路径
    let dbPath;
    if (options.inMemoryOnly) {
      dbPath = null;
    } else {
      // 默认存储路径
      const defaultPath = path.join(__dirname, '../../../../../../../.promptx/memory/longterm.db');
      dbPath = options.dbPath || process.env.LONG_TERM_DB_PATH || defaultPath;
    }
    
    // 初始化存储（临时使用内存实现）
    this.db = new InMemoryDatastore({ 
      filename: dbPath,
      autoload: true 
    });
    
    // 创建索引：支持数组字段的高效查询
    this.db.ensureIndex({ fieldName: 'cues' });
    this.db.ensureIndex({ fieldName: 'type' });
    this.db.ensureIndex({ fieldName: 'timestamp' });
  }

  remember(engram) {
    return new Promise((resolve, reject) => {
      const doc = {
        _id: engram.getId(),
        content: engram.getContent(),
        type: engram.getType(),
        timestamp: engram.timestamp || new Date(),
        strength: engram.getStrength(),
        cues: this.extractCuesFromEngram(engram),  // 索引数组
        engram: this.serializeEngram(engram)       // 序列化的完整对象
      };
      
      // 使用upsert确保不重复
      this.db.update(
        { _id: doc._id },
        doc,
        { upsert: true },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  recall(cue) {
    return new Promise((resolve) => {
      logger.info('[LongTerm.recall] Starting recall with cue:', cue);
      
      if (!cue || typeof cue !== 'string') {
        // 无线索时返回所有记忆
        this.db.find({}).sort({ timestamp: -1 }).exec((err, docs) => {
          if (err) {
            logger.error('[LongTerm.recall] Error finding all docs:', err);
            resolve([]);
          } else {
            logger.info('[LongTerm.recall] Found all docs count:', docs.length);
            resolve(docs.map(doc => this.deserializeEngram(doc.engram)));
          }
        });
      } else {
        // 基于cue查询：在cues数组中查找（不区分大小写）
        const lowercaseCue = cue.toLowerCase();
        logger.info('[LongTerm.recall] Searching with lowercaseCue:', lowercaseCue);
        
        this.db.find({}).exec((err, docs) => {
          if (err) {
            logger.error('[LongTerm.recall] Error finding docs:', err);
            resolve([]);
          } else {
            logger.info('[LongTerm.recall] Total docs in db:', docs.length);
            
            // 打印前3个文档的cues用于调试
            docs.slice(0, 3).forEach((doc, index) => {
              logger.info(`[LongTerm.recall] Doc ${index} cues:`, doc.cues ? doc.cues.slice(0, 5) : 'NO CUES');
            });
            
            // 手动过滤，因为我们的内存实现的查询功能有限
            let matchCount = 0; // 用于跟踪匹配数量
            const filtered = docs.filter(doc => {
              const hasCues = doc.cues && Array.isArray(doc.cues);
              if (!hasCues) {
                logger.info('[LongTerm.recall] Doc has no cues:', doc._id);
                return false;
              }
              
              const matches = doc.cues.some(c => {
                const cueStr = c.toLowerCase();
                const isMatch = cueStr.includes(lowercaseCue);
                if (isMatch && matchCount < 3) { // 只记录前3个匹配
                  logger.info(`[LongTerm.recall] Cue match found: "${c}" contains "${lowercaseCue}"`);
                  matchCount++;
                }
                return isMatch;
              });
              
              return matches;
            });
            
            logger.info('[LongTerm.recall] Filtered results count:', filtered.length);
            
            // 按strength和timestamp排序
            filtered.sort((a, b) => {
              // 先按strength降序
              if (b.strength !== a.strength) {
                return b.strength - a.strength;
              }
              // strength相同则按timestamp降序
              return new Date(b.timestamp) - new Date(a.timestamp);
            });
            
            resolve(filtered.map(doc => this.deserializeEngram(doc.engram)));
          }
        });
      }
    });
  }

  /**
   * 从Engram中提取所有Cue用于索引
   * @private
   */
  extractCuesFromEngram(engram) {
    const cues = new Set();
    
    // 1. 添加完整的content作为一个cue（用于精确匹配）
    if (engram.getContent()) {
      const content = engram.getContent();
      logger.info('[LongTerm.extractCues] Original content:', content);
      
      // 添加完整内容的小写版本
      cues.add(content.toLowerCase());
      
      // 2. 智能提取关键词组和概念（保留完整概念）
      // 提取中文词组（2-8个字的连续中文，覆盖大部分概念）
      const chinesePatterns = content.match(/[\u4e00-\u9fa5]{2,8}/g) || [];
      chinesePatterns.forEach(pattern => cues.add(pattern.toLowerCase()));
      
      // 提取英文单词和词组
      const englishPatterns = content.match(/[A-Za-z][A-Za-z0-9]*/g) || [];
      englishPatterns.forEach(pattern => cues.add(pattern.toLowerCase()));
      
      // 提取混合词（如"Sean总"）
      const mixedPatterns = content.match(/[A-Za-z]+[\u4e00-\u9fa5]+|[\u4e00-\u9fa5]+[A-Za-z]+/g) || [];
      mixedPatterns.forEach(pattern => cues.add(pattern.toLowerCase()));
      
      // 3. 基础分词作为补充（用于模糊匹配）
      const words = content
        .toLowerCase()
        .split(/[\s,，。.!！?？;；:：、()（）\[\]【】{}｛｝]+/)
        .filter(word => word.length > 1);
      words.forEach(word => cues.add(word));
      
      logger.info('[LongTerm.extractCues] Content cues:', Array.from(cues).slice(0, 10));
    }
    
    // 4. 从Schema中提取完整的概念节点（不分词）
    if (engram.schema) {
      logger.info('[LongTerm.extractCues] Original schema:', engram.schema.substring(0, 200));
      
      // 按行分割，每行可能是一个概念节点
      const lines = engram.schema.split('\n');
      
      lines.forEach(line => {
        // 清理行，移除mindmap语法但保持概念完整
        let cleanLine = line.trim();
        
        // 跳过mindmap声明和root
        if (cleanLine === 'mindmap' || cleanLine.startsWith('root((')) {
          // 但要提取root中的内容
          const rootMatch = cleanLine.match(/root\(\((.+?)\)\)/);
          if (rootMatch) {
            cues.add(rootMatch[1].toLowerCase());
          }
          return;
        }
        
        // 移除缩进（保留概念）
        cleanLine = cleanLine.replace(/^\s+/, '');
        
        // 移除强度标记 [0.95] 等
        cleanLine = cleanLine.replace(/\[[\d.]+\]/, '').trim();
        
        // 如果还有内容，添加为cue（保持完整）
        if (cleanLine && cleanLine.length > 1) {
          cues.add(cleanLine.toLowerCase());
          
          // 如果包含空格，也添加空格分割的版本（为了兼容性）
          if (cleanLine.includes(' ')) {
            cleanLine.split(/\s+/).forEach(part => {
              if (part.length > 1) {
                cues.add(part.toLowerCase());
              }
            });
          }
        }
      });
      
      logger.info('[LongTerm.extractCues] Schema cues:', Array.from(cues).slice(-10)); // 记录最后10个
    }
    
    const cuesArray = Array.from(cues);
    logger.info('[LongTerm.extractCues] Final cues count:', cuesArray.length, 'Sample:', cuesArray.slice(0, 15));
    return cuesArray;
  }

  /**
   * 序列化Engram对象以便存储
   * @private
   */
  serializeEngram(engram) {
    return {
      id: engram.getId(),
      content: engram.getContent(),
      type: engram.getType(),
      strength: engram.getStrength(),
      timestamp: engram.timestamp,
      // Schema 是 Mermaid 格式字符串，直接保存
      schema: engram.schema || null
    };
  }

  /**
   * 反序列化存储的对象为Engram
   * @private
   */
  deserializeEngram(data) {
    // 重建真正的 Engram 实例
    const { Engram } = require('../../engram/Engram');
    const engram = new Engram(data.content, data.schema, data.type);
    
    // 恢复其他属性
    engram.id = data.id;
    engram.strength = data.strength;
    engram.timestamp = new Date(data.timestamp);
    
    return engram;
  }

  /**
   * 获取存储的记忆总数
   */
  size() {
    return new Promise((resolve) => {
      this.db.count({}, (err, count) => {
        resolve(err ? 0 : count);
      });
    });
  }

  /**
   * 压缩数据库文件
   */
  compact() {
    this.db.persistence.compactDatafile();
  }
}

module.exports = { LongTerm };