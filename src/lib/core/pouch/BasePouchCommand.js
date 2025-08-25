const BaseArea = require('./areas/BaseArea')
const LegacyArea = require('./areas/common/LegacyArea')
const BaseLayer = require('./layers/BaseLayer')
const logger = require('../../utils/logger')
const CognitionCycleGuide = require('../cognition/CognitionCycleGuide')

/**
 * BasePouchCommand - 支持Layer和Area双架构的命令基类
 * 
 * 架构设计：
 * - 支持新的Layer架构：Command → Layers → Areas
 * - 兼容旧的Area架构：Command → Areas
 * - 统一的渲染管道处理所有内容
 * 
 * 渲染流程：
 * 1. 如果有Layers，按优先级渲染Layers
 * 2. 如果没有Layers但有Areas，直接渲染Areas（兼容模式）
 * 3. Layers内部管理自己的Areas
 */
class BasePouchCommand {
  constructor() {
    this.context = {
      currentPouch: '',
      history: [],
      userProfile: {},
      sessionData: {},
      domainContext: {}
    }
    this.outputFormat = 'human'
    this.areas = []
    this.layers = []
    this.useLayerSystem = false // 标记是否使用Layer系统
  }

  /**
   * 注册一个Area
   * @param {BaseArea} area - Area实例
   */
  registerArea(area) {
    if (!(area instanceof BaseArea)) {
      throw new Error('Area must extend BaseArea')
    }
    
    // 检查名称唯一性
    if (this.areas.some(a => a.getName() === area.getName())) {
      throw new Error(`Area with name '${area.getName()}' already registered`)
    }
    
    this.areas.push(area)
  }

  /**
   * 清空所有Areas
   */
  clearAreas() {
    this.areas = []
  }

  /**
   * 注册一个Layer
   * @param {BaseLayer} layer - Layer实例
   */
  registerLayer(layer) {
    if (!(layer instanceof BaseLayer)) {
      throw new Error('Layer must extend BaseLayer')
    }
    
    // 检查名称唯一性
    if (this.layers.some(l => l.getName() === layer.getName())) {
      throw new Error(`Layer with name '${layer.getName()}' already registered`)
    }
    
    this.layers.push(layer)
    this.useLayerSystem = true // 标记使用Layer系统
    
    logger.debug(`[BasePouchCommand] Registered layer: ${layer.getName()}`)
  }

  /**
   * 清空所有Layers
   */
  clearLayers() {
    this.layers = []
    this.useLayerSystem = false
  }

  /**
   * 组装Areas（子类可重写）
   * @param {Array} args - 命令参数
   * @returns {Promise<void>}
   */
  async assembleAreas(args) {
    // 检查是否有旧的getPurpose/getContent方法
    if (typeof this.getPurpose === 'function' && typeof this.getContent === 'function') {
      // 兼容模式：使用LegacyArea包装旧命令
      const purpose = this.getPurpose()
      const content = await this.getContent(args)
      const pateoas = typeof this.getPATEOAS === 'function' ? this.getPATEOAS(args) : null
      
      const legacyArea = new LegacyArea(purpose, content, pateoas)
      this.registerArea(legacyArea)
    } else {
      // 新架构的命令必须自己实现assembleAreas
      throw new Error('Subclass must implement assembleAreas() or provide getPurpose()/getContent()')
    }
  }

  /**
   * 组装Layers（子类可重写）
   * @param {Array} args - 命令参数
   * @returns {Promise<void>}
   */
  async assembleLayers(args) {
    // 子类实现具体的Layer组装逻辑
    // 默认不做任何操作
  }

  /**
   * 验证所有Areas
   * @returns {boolean}
   */
  validateAreas() {
    return this.areas.every(area => area.validate())
  }

  /**
   * 验证所有Layers
   * @returns {boolean}
   */
  validateLayers() {
    return this.layers.every(layer => layer.validate())
  }

  /**
   * 渲染所有Areas
   * @returns {Promise<string>}
   */
  async renderAreas() {
    const contents = []
    
    for (const area of this.areas) {
      const content = await area.render()
      if (content) {
        contents.push(area.format(content))
      }
    }
    
    return contents.join('')
  }

  /**
   * 渲染所有Layers
   * @returns {Promise<string>}
   */
  async renderLayers() {
    // 按优先级排序Layers（数字越小优先级越高）
    const sortedLayers = [...this.layers].sort((a, b) => a.getPriority() - b.getPriority())
    
    const contents = []
    const layerSeparator = '='.repeat(75)
    
    for (let i = 0; i < sortedLayers.length; i++) {
      const layer = sortedLayers[i]
      if (layer.isEnabled()) {
        const content = await layer.render(this.context)
        if (content) {
          contents.push(content)
          // 在非空Layer之间添加分隔符
          if (i < sortedLayers.length - 1) {
            // 检查是否还有后续的非空Layer
            const hasMoreContent = sortedLayers.slice(i + 1).some(l => l.isEnabled())
            if (hasMoreContent) {
              contents.push('\n' + layerSeparator + '\n')
            }
          }
        }
      }
    }
    
    return contents.join('')
  }

  /**
   * 执行命令
   * @param {Array} args - 命令参数
   * @returns {Promise<Object|string>}
   */
  async execute(args = []) {
    // 清空之前的内容
    this.clearAreas()
    this.clearLayers()
    
    // 尝试组装Layers（新架构）
    await this.assembleLayers(args)
    
    // 如果没有Layers，尝试组装Areas（兼容模式）
    if (!this.useLayerSystem) {
      await this.assembleAreas(args)
    }
    
    let content = ''
    
    // 使用Layer系统渲染
    if (this.useLayerSystem) {
      logger.debug('[BasePouchCommand] Using Layer system for rendering')
      
      // 验证Layers
      if (!this.validateLayers()) {
        throw new Error('Layer validation failed')
      }
      
      // 渲染Layers
      content = await this.renderLayers()
    } 
    // 使用传统Area系统渲染
    else {
      logger.debug('[BasePouchCommand] Using Area system for rendering')
      
      // 验证Areas
      if (!this.validateAreas()) {
        throw new Error('Area validation failed')
      }
      
      // 渲染Areas
      content = await this.renderAreas()
    }
    
    // 格式化输出
    return this.formatOutput(content)
  }

  /**
   * 格式化最终输出
   * @param {string} content - 渲染的内容
   * @returns {Object|string}
   */
  formatOutput(content) {
    if (this.outputFormat === 'json') {
      return {
        content,
        areas: this.areas.map(a => a.getMetadata()),
        context: this.context,
        format: this.outputFormat
      }
    }
    
    // 人类可读格式
    const output = {
      content,
      context: this.context,
      format: this.outputFormat
    }
    
    return {
      ...output,
      toString() {
        return content
      }
    }
  }

  /**
   * 设置状态上下文
   * @param {Object} context - 状态上下文
   */
  setContext(context) {
    this.context = { ...this.context, ...context }
  }

  /**
   * 设置输出格式
   * @param {'human'|'json'} format - 输出格式
   */
  setOutputFormat(format) {
    this.outputFormat = format
  }

  /**
   * 获取锦囊目的说明（子类必须实现）
   * @returns {string} 目的说明
   */
  getPurpose () {
    throw new Error('子类必须实现 getPurpose 方法')
  }

  /**
   * 获取锦囊内容（子类必须实现）
   * @param {Array} args - 命令参数
   * @returns {Promise<string>} 锦囊内容
   */
  async getContent (args) {
    throw new Error('子类必须实现 getContent 方法')
  }

  /**
   * 获取PATEOAS导航信息（子类必须实现）
   * @param {Array} args - 命令参数
   * @returns {PATEOASNavigation} PATEOAS导航
   */
  getPATEOAS (args) {
    throw new Error('子类必须实现 getPATEOAS 方法')
  }

  /**
   * 格式化输出
   * @param {string} purpose - 目的说明
   * @param {string} content - 内容
   * @param {PATEOASNavigation} pateoas - PATEOAS导航
   * @returns {PouchOutput} 格式化的输出
   */
  formatOutput (purpose, content, pateoas) {
    const output = {
      purpose,
      content,
      pateoas,
      context: this.context,
      format: this.outputFormat
    }

    if (this.outputFormat === 'json') {
      return output
    }

    // 保存命令名称到闭包
    const commandName = this.constructor.name
    
    // 人类可读格式
    return {
      ...output,
      toString () {
        const divider = '='.repeat(60)
        const nextSteps = (pateoas.nextActions || [])
          .map(action => `  - ${action.name}: ${action.description}\n    方式: ${action.method || action.command || '通过MCP工具'}`)
          .join('\n')

        // 根据当前状态和命令类型添加认知循环引导
        let cycleGuide = ''
        const currentState = pateoas.currentState || ''
        
        // 简单粗暴的判断 - Linus style: if语句就够了！
        if (commandName === 'ActionCommand' && currentState.includes('role_activated')) {
          // 角色激活时 - 循环开始
          cycleGuide = CognitionCycleGuide.getActionGuide()
        } else if (commandName === 'RecallCommand') {
          // Recall 命令 - 吸气完成（无论成功还是失败）
          cycleGuide = CognitionCycleGuide.getRecallGuide()
        } else if (commandName === 'RememberCommand' && currentState.includes('memory_saved')) {
          // Remember 之后 - 呼气完成，循环结束
          cycleGuide = CognitionCycleGuide.getRememberGuide()
        }

        return `${divider}
🎯 锦囊目的：${purpose}
${divider}

📜 锦囊内容：
${content}${cycleGuide ? '\n' + divider + cycleGuide : ''}

🔄 下一步行动：
${nextSteps}

📍 当前状态：${pateoas.currentState}
${divider}`
      }
    }
  }
}

module.exports = BasePouchCommand