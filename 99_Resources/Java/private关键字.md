---
tags:
  - private关键字
---
=
# private 修饰方法的情况

你的笔记总结得不错。回答你的问题：**如果 bean 类中的方法被 `private` 修饰，外部是无法"合法访问"的——这正是 `private` 的目的。** 但需要分情况说清楚。

## 一、核心结论

`private` 方法 **只能在本类内部被调用**，外部（包括同包的其他类、子类）都无法直接访问。既然设计者把它设为 `private`，说明这个方法 **本来就不打算对外暴露**，它是内部实现的辅助逻辑。

所以外部"合法访问"的方式不是去访问这个方法本身，而是访问该类对外暴露的 **public 方法**，由这个 public 方法在内部去调用 private 方法。

## 二、典型场景：private 方法是内部辅助方法

```java
public class User {
    private String name;
    private int age;

    public void setAge(int age) {
        if (isValidAge(age)) {   // 本类内部调用 private 方法
            this.age = age;
        }
    }

    // private 方法：只服务于本类内部，外部无法直接调用
    private boolean isValidAge(int age) {
        return age > 0 && age < 150;
    }

    public int getAge() {
        return age;
    }
}
```

外部使用：

```java
User u = new User();
u.setAge(25);        // 合法，通过 public 方法
// u.isValidAge(25); // 编译报错！private 方法外部不可访问
```

这里 `isValidAge` 就是被 `private` 修饰的"校验方法"，外部不需要、也不应该直接调用它，它的存在只是为了让 `setAge` 内部逻辑更清晰。

## 三、为什么 bean 里的方法会被设为 private？

常见原因：

1. **内部工具/校验方法**：如上面的 `isValidAge`，只给本类的 set 方法用。
2. **防止外部破坏封装**：比如一个"重置内部状态"的方法，只允许类内部在特定时机调用。
3. **构造函数私有**（单例模式等）：`private` 构造方法让外部不能 `new`，只能通过 `getInstance()` 获取实例。

单例示例：

```java
public class Singleton {
    private static final Singleton INSTANCE = new Singleton();

    private Singleton() {}   // 外部不能 new

    public static Singleton getInstance() {  // 外部合法入口
        return INSTANCE;
    }
}
```

## 四、如果确实需要外部访问，怎么办？

有两种正规做法：

1. **改成 public / protected**（在保证不破坏封装的前提下）。这是最直接的办法。
2. **通过反射**（`setAccessible(true)`）强行访问。但这属于"非正常手段"，破坏了封装，一般不推荐，只在框架、测试等特殊场景使用。

```java
Method m = User.class.getDeclaredMethod("isValidAge", int.class);
m.setAccessible(true);
boolean r = (boolean) m.invoke(user, 25); // 能跑，但不推荐
```

## 五、一句话总结

| 修饰符 | 本类 | 同包 | 子类 | 任意类 |
|--------|------|------|------|--------|
| private | ✅ | ❌ | ❌ | ❌ |
| 默认 | ✅ | ✅ | ❌ | ❌ |
| protected | ✅ | ✅ | ✅ | ❌ |
| public | ✅ | ✅ | ✅ | ✅ |

** `private` 方法没有"外部合法访问"这一说**——它的设计意图就是只给本类用。外部要合法拿到结果，只能通过该类对外暴露的 `public` 方法间接实现。如果你发现外部确实需要调用某个 private 方法，那通常意味着这个方法的权限设计需要重新考虑（改成 public/protected），而不是想办法绕过 private。

这和成员变量的思路是一致的：**变量用 private + get/set 暴露；方法如果是内部逻辑就保持 private，如果是功能入口就该是 public。**