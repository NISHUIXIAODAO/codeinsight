package com.codeinsight.api.service;

import java.util.ArrayList;
import java.util.List;

public class JavaRoleClassifier {
    public static String classify(String packageName, String simpleName, List<String> annotations, boolean isInterface) {
        String pkg = packageName == null ? "" : packageName.toLowerCase();
        String cn = simpleName == null ? "" : simpleName;
        String cnLower = cn.toLowerCase();
        List<String> anns = new ArrayList<>();
        if (annotations != null) {
            for (String a : annotations) {
                anns.add(a == null ? "" : a.toLowerCase());
            }
        }

        if (anns.contains("restcontroller") || anns.contains("controller")) return "controller";
        if (anns.contains("service")) return cnLower.endsWith("impl") ? "serviceImpl" : "service";
        if (anns.contains("repository")) return "repository";
        if (anns.contains("mapper")) return "mapper";
        if (anns.contains("configuration")) return "config";
        if (anns.contains("component")) return "component";
        if (anns.contains("entity") || anns.contains("table")) return "entity";

        if (pkg.contains(".controller") || cnLower.endsWith("controller")) return "controller";
        if (pkg.contains(".service.impl") || cnLower.endsWith("serviceimpl") || cnLower.endsWith("impl")) return "serviceImpl";
        if (pkg.contains(".service") || cnLower.endsWith("service")) return "service";
        if (pkg.contains(".repository") || pkg.contains(".dao") || cnLower.endsWith("repository") || cnLower.endsWith("dao")) return "repository";
        if (pkg.contains(".mapper") || cnLower.endsWith("mapper")) return "mapper";
        if (pkg.contains(".entity") || pkg.contains(".model") || cnLower.endsWith("entity") || cnLower.endsWith("po")) return "entity";
        if (pkg.contains(".dto") || pkg.contains(".vo") || cnLower.endsWith("dto") || cnLower.endsWith("vo")) return "dto";
        if (pkg.contains(".config") || cnLower.endsWith("config")) return "config";
        if (pkg.contains(".util") || pkg.contains(".utils") || cnLower.endsWith("util") || cnLower.endsWith("utils") || cnLower.endsWith("helper")) return "util";

        if (isInterface) {
            if (cnLower.endsWith("service")) return "service";
            if (cnLower.endsWith("mapper")) return "mapper";
            if (cnLower.endsWith("repository")) return "repository";
        }

        return "other";
    }
}
