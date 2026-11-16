---
tags:
  - Rantime
  - API
---
`java.lang.Runtime` 类主要代表**当前 Java 程序运行时的环境**。与 `System` 类类似，它也是一个核心类，但它有一个非常显著的特点：**单例模式**。

因为一个 JVM 进程只对应一个运行时环境，所以你不能（也不需要）用 `new Runtime()` 来创建对象。必须通过 `Runtime.getRuntime()` 获取当前唯一的实例。

它主要用于与操作系统交互、管理内存、执行外部命令等底层操作。

以下是 `Runtime` 类最常用的方法，同样分类给你讲：

---

### 一、 获取实例（必须的第一步）

| 方法 | 说明 | 示例 |
| :--- | :--- | :--- |
| ** `getRuntime()` ** | 获取当前 JVM 的 Runtime 实例。 | `Runtime rt = Runtime.getRuntime();` |

---

### 二、 内存管理（最常用）

`Runtime` 可以让你实时看到 JVM 的内存“家底”，常用于排查内存泄漏或性能调优。

| 方法 | 说明 | 示例 |
| :--- | :--- | :--- |
| ** `totalMemory()` ** | 返回 JVM **当前已经向操作系统申请到的总内存**（字节）。注意：这不是系统最大内存，而是当前堆内存的大小。 | `long total = rt.totalMemory();` |
| ** `freeMemory()` ** | 返回 JVM 堆内存中**空闲内存**的大小（字节）。 | `long free = rt.freeMemory();` |
| ** `maxMemory()` ** | 返回 JVM **能向操作系统申请的最大内存上限**（字节）。通常由启动参数 `-Xmx` 决定。 | `long max = rt.maxMemory();` |
| ** `availableProcessors()` ** | 返回当前机器**可用的 CPU 核心数**。在写多线程代码时经常用它来决定线程池大小。 | `int cpu = rt.availableProcessors();` |

💡 **实用小技巧**：计算实际已使用内存
```java
long usedMemory = rt.totalMemory() - rt.freeMemory();
// 通常我们会把它转换成 MB 方便看
System.out.println("已使用内存: " + usedMemory / 1024 / 1024 + " MB");
```

---

### 三、 执行外部程序 / 命令（非常强大）

| 方法 | 说明 | 示例 |
| :--- | :--- | :--- |
| ** `exec(String command)` ** | 在**当前操作系统**中执行一条命令（就像你在 CMD 或终端里敲命令一样），返回一个 `Process` 对象。 | `rt.exec("notepad.exe");` （打开记事本）<br>`rt.exec("ping www.baidu.com");` |
| ** `exec(String[] cmdarray)` ** | 执行带参数的命令。 | `rt.exec(new String[]{"cmd", "/c", "dir"});` |

⚠️ **注意：** `exec()` 返回的 `Process` 对象可以用来获取命令的输出结果。但由于它不会自动读取输出流，如果命令输出内容很多，**可能会导致卡死**，一般需要另开线程读取 `process.getInputStream()`。

---

### 四、 程序控制

| 方法 | 说明 | 示例 |
| :--- | :--- | :--- |
| ** `exit(int status)` ** | 终止当前 JVM 运行。效果和 `System.exit(status)` 一模一样，底层就是调用的这个。 | `rt.exit(0);` |
| ** `halt(int status)` ** | **强行终止** JVM。与 `exit` 不同，`halt` 不会执行任何 `finally` 代码块，也不会执行 JVM 的关闭钩子（Shutdown Hook），属于“拔电源”级别的操作，非常暴力，慎用。 | `rt.halt(0);` |

---

### 五、 垃圾回收与关闭钩子

| 方法 | 说明 | 示例 |
| :--- | :--- | :--- |
| ** `gc()` ** | 建议 JVM 进行垃圾回收。这和 `System.gc()` 是一样的，也只是个**建议**，JVM 不一定马上执行。 | `rt.gc();` |
| ** `addShutdownHook(Thread hook)` ** | 添加一个**关闭钩子**。当 JVM 正常退出（比如用户按 Ctrl+C、或者 `System.exit()`）时，会触发这个线程。**常用于释放资源、保存数据等收尾工作。** | `rt.addShutdownHook(new Thread(() -> System.out.println("程序退出了，清理数据...")));` |

---

### 六、 加载本地库

| 方法 | 说明 |
| :--- | :--- |
| ** `load(String filename)` ** | 加载指定路径下的本地库文件（如 C/C++ 编译出来的 `.dll` 或 `.so` 文件）。 |
| ** `loadLibrary(String libname)` ** | 加载系统默认路径（`java.library.path`）下的本地库。 |

（日常业务开发很少用到，主要用于 JNI 调用底层 C 代码时使用。）

---

### 💡 综合实战代码示例

下面这段代码演示了如何查看当前机器的内存和 CPU 情况，以及如何打开本机的计算器：

```java
public class RuntimeDemo {
    public static void main(String[] args) throws Exception {
        // 1. 获取 Runtime 实例
        Runtime rt = Runtime.getRuntime();

        // 2. 查看 CPU 核心数
        System.out.println("本机 CPU 核心数: " + rt.availableProcessors());

        // 3. 查看内存情况 (转换为 MB)
        long max = rt.maxMemory() / 1024 / 1024;
        long total = rt.totalMemory() / 1024 / 1024;
        long free = rt.freeMemory() / 1024 / 1024;
        long used = total - free;

        System.out.println("JVM 最大可用内存: " + max + " MB");
        System.out.println("JVM 当前申请总内存: " + total + " MB");
        System.out.println("JVM 当前空闲内存: " + free + " MB");
        System.out.println("JVM 已使用内存: " + used + " MB");

        // 4. 添加一个关闭钩子（当程序正常退出时触发）
        rt.addShutdownHook(new Thread(() -> {
            System.out.println("=== JVM 正在关闭，清理临时文件... ===");
        }));

        // 5. 执行外部命令（这里以打开 Windows 计算器为例，Mac 可改为 "open -a Calculator"）
        // 注意：exec 会抛出 IOException，需处理
        Process process = rt.exec("calc.exe");
        System.out.println("计算器已打开，PID: " + process.pid());
    }
}
```

### 总结记忆
*   **想查内存/CPU**：找 `totalMemory` / `freeMemory` / `availableProcessors`
*   **想调外部程序**：找 `exec`（注意读流防阻塞）
*   **想强杀程序**：用 `halt`（`exit` 是正常退，`halt` 是拔电源）
*   **想收尾工作**：用 `addShutdownHook`

**对比 `System` 和 `Runtime`：**
*   `System.exit()` 底层其实就是调用的 `Runtime.getRuntime().exit()`。
*   `System.gc()` 底层其实就是调用的 `Runtime.getRuntime().gc()`。
*   `System` 更偏向**通用工具**（打印、计时、数组复制），`Runtime` 更偏向 **JVM 环境操控**。