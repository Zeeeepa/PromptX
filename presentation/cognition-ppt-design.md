# Cognition系统PPT设计

## 第1页 - 标题页
**标题：** 基于认知心理学的Agent记忆系统
**副标题：** PromptX Cognition
**底部信息：** deepractice.ai | 2025.01

---

## 第2页 - Live Demo：角色记忆植入
**标题：** 从空白到专家：记忆的力量

**演示设置：**
- 两个空白角色：one, two
- 两份虚拟简历：
  - 李晓雯 - 总经理助理（7年经验）
  - 张伟 - Java高级工程师（5年经验）

**演示流程：**
1. 展示空白角色（无记忆状态）
2. 通过Cognition系统植入简历记忆
3. 角色立即获得完整的：
   - 个人身份认知
   - 专业技能体系
   - 工作经验记忆
   - 项目案例库
4. 验证：向角色提问，展示记忆效果

**核心展示：**
```
空白Agent + 记忆系统 = 专业人格
```

---

## 第3页 - Engram：AI的主动记忆编码
**标题：** Engram - 记忆痕迹的设计哲学

**上部：认知心理学理论**
- Engram（记忆痕迹）概念来源
- 人类记忆的双重编码理论
  - 语义编码（概念理解）
  - 情景编码（具体内容）

**中部：核心理念**
```
重要：Engram是AI自己生成的！
就像人类大脑主动编码记忆一样
```

**AI主动记忆过程：**
1. AI接收信息："张伟是Java工程师"
2. AI主动理解并编码：
   - 提取关键信息（content）
   - 构建认知结构（schema）
   - 评估重要性（strength）
3. 生成Engram存入记忆系统

**代码示例：**
```javascript
// AI自主生成Engram
const engram = {
  content: "张伟是Java工程师，在美团工作",  // AI理解的内容
  schema: `mindmap                         // AI构建的认知结构
    张伟
      职业: Java工程师
      公司: 美团`,
  strength: 0.9,  // AI评估的重要性
  type: "ATOMIC"
}

// 系统只负责存储
cognition.remember(engram)
```

**底部强调：**
- ✅ AI主动编码记忆（像人类一样）
- ✅ 系统只负责存储和检索
- ✅ 真正的认知主体，不是存储工具

---

## 第4页 - 记忆筛选：不是所有都值得记住
**标题：** Evaluator - 记忆的第一道门槛

**类比图示：**
```
信息流入 ➜ [👂左耳] ➜ Evaluator筛选 ➜ [👂右耳] ➜ 信息流出
                         ↓
                   值得记住的信息
                         ↓
                    进入记忆系统
```

**认知心理学原理：**
- 人类大脑的"注意力过滤器"
- 只有重要信息才进入工作记忆
- "左耳进右耳出"现象

**代码实现：**
```javascript
class Evaluator {
  evaluate(engram) {
    // AI生成的记忆需要通过评估
    if (engram.strength < 0.3) {
      return false;  // 强度太低，直接忽略
    }
    if (isNoise(engram.content)) {
      return false;  // 噪音信息，过滤掉
    }
    return true;  // 通过评估，值得记住
  }
}
```

**筛选标准：**
- 记忆强度（strength）阈值
- 信息质量评估
- 重复信息去重
- 噪音过滤

**底部强调：**
像人类一样，有选择地记忆，避免信息过载

---

## 第5页 - 记忆巩固：从短期到长期
**标题：** Consolidator - 记忆的分流巩固

**认知原理图：**
```
        Engram（通过筛选）
              ↓
        Consolidator
        （巩固器）
         ╱        ╲
        ↙          ↘
   LongTerm     Semantic
  （长期记忆）   （语义网络）
   持久存储      知识关联
```

**认知心理学原理：**
- 记忆巩固理论（Memory Consolidation）
- 海马体的双重功能：
  - 存储具体事件（情景记忆）
  - 提取概念关系（语义记忆）

**代码实现：**
```javascript
class Consolidator {
  consolidate(engram) {
    // 1. 巩固到长期记忆（永久存储）
    this.longTerm.remember(engram);
    
    // 2. 巩固到语义网络（构建知识图谱）
    this.semantic.integrate(engram.schema);
    
    // 双轨并行，互不干扰
  }
}
```

**巩固效果：**
- **LongTerm**：完整保存原始记忆，支持精确回忆
- **Semantic**：提取知识结构，构建概念网络

**底部强调：**
一次记忆，两种存储，满足不同认知需求

---

## 第6页 - Prime启动效应：记忆的预激活
**标题：** Prime - 唤醒沉睡的记忆网络

**认知心理学原理：**
- 启动效应（Priming Effect）
- 激活扩散理论（Spreading Activation）
- 工作记忆预加载

**Prime机制图示：**
```
        cognition.prime()
              ↓
    ┌─────────┴─────────┐
    │                   │
语义网络激活        程序性记忆激活
    │                   │
    ↓                   ↓
Mindmap可视化      行为模式加载
```

**代码实现：**
```javascript
// 启动语义网络
const mindmap = await cognition.prime();
// 返回结果：
{
  mindmap: `mindmap
    ((global-semantic))
      张伟
        职业: Java工程师
        技能: Spring Cloud
      李晓雯
        职业: 总经理助理
        经验: 7年`,
  workingMemory: [...],  // 高权重记忆
  threshold: 0.8          // 激活阈值
}

// 启动程序性记忆
const procedures = await cognition.primeProcedural();
```

**Prime的作用：**
- 预加载相关记忆到"工作记忆"
- 降低后续检索延迟
- 构建当前认知上下文
- 可视化知识结构

**底部强调：**
像人类早晨醒来，激活昨天的记忆继续今天的工作

---

## 第7页 - Mind三层架构
**标题：** 层次化认知组织

**金字塔图：**
```
    NetworkSemantic (L3)
         ▲
    GraphSchema (L2)
         ▲
     WordCue (L1)
```

---

## 第8页 - 语义网络可视化
**标题：** 动态知识图谱

**Mindmap展示：**
- 实际的mindmap渲染效果
- 节点权重可视化
- 激活扩散示意

---

## 第9页 - Think思维链
**标题：** 模拟思考过程

**流程图：**
```
目标设定 → 模式选择 → 记忆激活 → 产生洞察 → 形成结论 → 置信评估
```

---

## 第10页 - 代码示例
**标题：** 简单易用的API

**代码块：**
```javascript
// 初始化
const cognition = new Cognition(config);

// 记忆
await cognition.remember(content, schema, strength);

// 回忆
const memories = await cognition.recall(cue);

// 思考
const thought = await cognition.think(thoughtObj);
```

---

## 第11页 - 性能指标
**标题：** 毫秒级响应

**数据展示：**
- 记忆写入: < 10ms
- 记忆检索: < 50ms  
- 网络构建: < 100ms
- 支持规模: 10k+ engrams

---

## 第12页 - 应用场景
**标题：** 实际应用

**三个场景卡片：**
1. 个人助手 - 记住用户偏好
2. 知识管理 - 构建企业记忆
3. 智能客服 - 积累服务经验

---

## 第13页 - 技术特色
**标题：** 核心创新

**要点列表：**
- Mindmap as Schema
- 层次化Mind架构
- 双系统记忆
- 动态权重机制
- 思维链原生支持

---

## 第14页 - 开源信息
**标题：** Join Us

**展示内容：**
- GitHub: github.com/Deepractice/PromptX
- npm: @promptx/cognition
- 文档: promptx.deepractice.ai
- License: MIT

---

## 第15页 - Q&A
**标题：** Questions?

**背景：** 简洁的图形或logo