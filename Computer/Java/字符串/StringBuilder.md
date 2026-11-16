---
tags:
  - StringBuilder
  - toString
  - StringJoiner
---
是一个容器，把字符串放在容器中，可以随时往里面添加字符串和进行字符串操作。
### 基本操作
1.创建对象
```
StringBuilder sb=new StringBuilder("abc");
```
2.添加元素
```
sb.append(1);
sb.append(2.5);
sb.appeend(jdks);
sb.append(true);
```
3.反转
```
sb.reverse();
``` 
4.获取长度
```
int len=sb.length();
```

### toString
StringBuilder 是一个容器，帮助操作字符串，所以使用完要用 toString 变回字符串
```
String str=sb.toString();
```

### StringJoiner
创建对象
![[Pasted image 20260922142123.png]]
