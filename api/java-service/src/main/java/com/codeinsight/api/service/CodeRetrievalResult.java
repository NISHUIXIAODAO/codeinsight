package com.codeinsight.api.service;

import com.codeinsight.api.dto.CodeCitation;

import java.util.List;

public class CodeRetrievalResult {
    private final List<CodeCitation> citations;
    private final String evidence;

    public CodeRetrievalResult(List<CodeCitation> citations, String evidence) {
        this.citations = citations;
        this.evidence = evidence;
    }

    public List<CodeCitation> getCitations() {
        return citations;
    }

    public String getEvidence() {
        return evidence;
    }
}

