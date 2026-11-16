---
tags:
  - git
---
## 日常备份命令
```
git add .
git commit -m "这次更新干了什么"
git push
```
## 查看历史版本
```
git log --oneline
```
## 临时查看某个版本
```
git checkout dd11974 //此处为想查看版本的ID，id由上一个命令输出
```

## 彻底恢复某个版本
```
git reset --hard 提交ID
```
这个命令可以直接恢复，但是此节点之后的修改都不做保存

```
git revert 提交ID
```
这个不会删除历史，而是创建一个反向修改